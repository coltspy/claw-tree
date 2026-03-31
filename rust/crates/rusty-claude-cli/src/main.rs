mod input;
mod render;

use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use api::{
    AnthropicClient, ContentBlockDelta, InputContentBlock, InputMessage, MessageRequest,
    MessageResponse, OutputContentBlock, StreamEvent as ApiStreamEvent, ToolChoice, ToolDefinition,
    ToolResultContentBlock,
};

use commands::handle_slash_command;
use compat_harness::{extract_manifest, UpstreamPaths};
use render::{Spinner, TerminalRenderer};
use runtime::{
    estimate_session_tokens, load_system_prompt, ApiClient, ApiRequest, AssistantEvent,
    CompactionConfig, ContentBlock, ConversationMessage, ConversationRuntime, MessageRole,
    PermissionMode, PermissionPolicy, PermissionPromptDecision, PermissionPrompter,
    PermissionRequest, RuntimeError, Session, TokenUsage, ToolError, ToolExecutor,
};
use tools::{execute_tool, mvp_tool_specs};

const DEFAULT_MODEL: &str = "claude-sonnet-4-20250514";
const DEFAULT_MAX_TOKENS: u32 = 32;
const DEFAULT_DATE: &str = "2026-03-31";
const DEFAULT_SESSION_LIMIT: usize = 20;

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().skip(1).collect();
    match parse_args(&args)? {
        CliAction::DumpManifests => dump_manifests(),
        CliAction::BootstrapPlan => print_bootstrap_plan(),
        CliAction::PrintSystemPrompt { cwd, date } => print_system_prompt(cwd, date),
        CliAction::ResumeSession {
            session_path,
            command,
        } => resume_session(&session_path, command),
        CliAction::ResumeNamed { target, command } => resume_named_session(&target, command),
        CliAction::InspectSession { target } => inspect_session(&target),
        CliAction::ListSessions { query, limit } => list_sessions(query.as_deref(), limit),
        CliAction::Prompt { prompt, model } => LiveCli::new(model, false)?.run_turn(&prompt)?,
        CliAction::Repl { model } => run_repl(model)?,
        CliAction::Help => print_help(),
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum CliAction {
    DumpManifests,
    BootstrapPlan,
    PrintSystemPrompt {
        cwd: PathBuf,
        date: String,
    },
    ResumeSession {
        session_path: PathBuf,
        command: Option<String>,
    },
    ResumeNamed {
        target: String,
        command: Option<String>,
    },
    InspectSession {
        target: String,
    },
    ListSessions {
        query: Option<String>,
        limit: usize,
    },
    Prompt {
        prompt: String,
        model: String,
    },
    Repl {
        model: String,
    },
    Help,
}

fn parse_args(args: &[String]) -> Result<CliAction, String> {
    let mut model = DEFAULT_MODEL.to_string();
    let mut rest = Vec::new();
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--model" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| "missing value for --model".to_string())?;
                model.clone_from(value);
                index += 2;
            }
            flag if flag.starts_with("--model=") => {
                model = flag[8..].to_string();
                index += 1;
            }
            other => {
                rest.push(other.to_string());
                index += 1;
            }
        }
    }

    if rest.is_empty() {
        return Ok(CliAction::Repl { model });
    }
    if matches!(rest.first().map(String::as_str), Some("--help" | "-h")) {
        return Ok(CliAction::Help);
    }
    if rest.first().map(String::as_str) == Some("--resume") {
        return parse_resume_args(&rest[1..]);
    }

    match rest[0].as_str() {
        "dump-manifests" => Ok(CliAction::DumpManifests),
        "bootstrap-plan" => Ok(CliAction::BootstrapPlan),
        "resume" => parse_named_resume_args(&rest[1..]),
        "session" => parse_session_inspect_args(&rest[1..]),
        "sessions" => parse_sessions_args(&rest[1..]),
        "system-prompt" => parse_system_prompt_args(&rest[1..]),
        "prompt" => {
            let prompt = rest[1..].join(" ");
            if prompt.trim().is_empty() {
                return Err("prompt subcommand requires a prompt string".to_string());
            }
            Ok(CliAction::Prompt { prompt, model })
        }
        other => Err(format!("unknown subcommand: {other}")),
    }
}

fn parse_system_prompt_args(args: &[String]) -> Result<CliAction, String> {
    let mut cwd = env::current_dir().map_err(|error| error.to_string())?;
    let mut date = DEFAULT_DATE.to_string();
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--cwd" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| "missing value for --cwd".to_string())?;
                cwd = PathBuf::from(value);
                index += 2;
            }
            "--date" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| "missing value for --date".to_string())?;
                date.clone_from(value);
                index += 2;
            }
            other => return Err(format!("unknown system-prompt option: {other}")),
        }
    }

    Ok(CliAction::PrintSystemPrompt { cwd, date })
}

fn parse_named_resume_args(args: &[String]) -> Result<CliAction, String> {
    let target = args
        .first()
        .ok_or_else(|| "missing session id, path, or 'latest' for resume".to_string())?
        .clone();
    let command = args.get(1).cloned();
    if args.len() > 2 {
        return Err("resume accepts at most one trailing slash command".to_string());
    }
    Ok(CliAction::ResumeNamed { target, command })
}

fn parse_session_inspect_args(args: &[String]) -> Result<CliAction, String> {
    let target = args
        .first()
        .ok_or_else(|| "missing session id, path, or 'latest' for session".to_string())?
        .clone();
    if args.len() > 1 {
        return Err("session accepts exactly one target argument".to_string());
    }
    Ok(CliAction::InspectSession { target })
}

fn parse_sessions_args(args: &[String]) -> Result<CliAction, String> {
    let mut query = None;
    let mut limit = DEFAULT_SESSION_LIMIT;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--query" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| "missing value for --query".to_string())?;
                query = Some(value.clone());
                index += 2;
            }
            "--limit" => {
                let value = args
                    .get(index + 1)
                    .ok_or_else(|| "missing value for --limit".to_string())?;
                limit = value
                    .parse::<usize>()
                    .map_err(|error| format!("invalid --limit value: {error}"))?;
                index += 2;
            }
            other => return Err(format!("unknown sessions option: {other}")),
        }
    }

    Ok(CliAction::ListSessions { query, limit })
}

fn parse_resume_args(args: &[String]) -> Result<CliAction, String> {
    let session_path = args
        .first()
        .ok_or_else(|| "missing session path for --resume".to_string())
        .map(PathBuf::from)?;
    let command = args.get(1).cloned();
    if args.len() > 2 {
        return Err("--resume accepts at most one trailing slash command".to_string());
    }
    Ok(CliAction::ResumeSession {
        session_path,
        command,
    })
}

fn dump_manifests() {
    let workspace_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    let paths = UpstreamPaths::from_workspace_dir(&workspace_dir);
    match extract_manifest(&paths) {
        Ok(manifest) => {
            println!("commands: {}", manifest.commands.entries().len());
            println!("tools: {}", manifest.tools.entries().len());
            println!("bootstrap phases: {}", manifest.bootstrap.phases().len());
        }
        Err(error) => {
            eprintln!("failed to extract manifests: {error}");
            std::process::exit(1);
        }
    }
}

fn print_bootstrap_plan() {
    for phase in runtime::BootstrapPlan::claude_code_default().phases() {
        println!("- {phase:?}");
    }
}

fn print_system_prompt(cwd: PathBuf, date: String) {
    match load_system_prompt(cwd, date, env::consts::OS, "unknown") {
        Ok(sections) => println!("{}", sections.join("\n\n")),
        Err(error) => {
            eprintln!("failed to build system prompt: {error}");
            std::process::exit(1);
        }
    }
}

fn resume_session(session_path: &Path, command: Option<String>) {
    let session = match Session::load_from_path(session_path) {
        Ok(session) => session,
        Err(error) => {
            eprintln!("failed to restore session: {error}");
            std::process::exit(1);
        }
    };

    match command {
        Some(command) if command.starts_with('/') => {
            let Some(result) = handle_slash_command(
                &command,
                &session,
                CompactionConfig {
                    max_estimated_tokens: 0,
                    ..CompactionConfig::default()
                },
            ) else {
                eprintln!("unknown slash command: {command}");
                std::process::exit(2);
            };
            if let Err(error) = result.session.save_to_path(session_path) {
                eprintln!("failed to persist resumed session: {error}");
                std::process::exit(1);
            }
            println!("{}", result.message);
        }
        Some(other) => {
            eprintln!("unsupported resumed command: {other}");
            std::process::exit(2);
        }
        None => {
            println!(
                "Restored session from {} ({} messages).",
                session_path.display(),
                session.messages.len()
            );
        }
    }
}

fn resume_named_session(target: &str, command: Option<String>) {
    let session_path = match resolve_session_target(target) {
        Ok(path) => path,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    };
    resume_session(&session_path, command);
}

fn list_sessions(query: Option<&str>, limit: usize) {
    match load_session_entries(query, limit) {
        Ok(entries) => {
            if entries.is_empty() {
                println!("No saved sessions found.");
                return;
            }
            println!("Saved sessions:");
            for entry in entries {
                println!(
                    "- {} | updated={} | messages={} | tokens={} | {}",
                    entry.id,
                    entry.updated_unix,
                    entry.message_count,
                    entry.total_tokens,
                    entry.preview
                );
            }
        }
        Err(error) => {
            eprintln!("failed to list sessions: {error}");
            std::process::exit(1);
        }
    }
}

fn inspect_session(target: &str) {
    let path = match resolve_session_target(target) {
        Ok(path) => path,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    };

    let session = match Session::load_from_path(&path) {
        Ok(session) => session,
        Err(error) => {
            eprintln!("failed to load session: {error}");
            std::process::exit(1);
        }
    };

    let metadata = fs::metadata(&path).ok();
    let updated_unix = metadata
        .as_ref()
        .and_then(|meta| meta.modified().ok())
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |duration| duration.as_secs());
    let bytes = metadata.as_ref().map_or(0, std::fs::Metadata::len);
    let usage = runtime::UsageTracker::from_session(&session).cumulative_usage();

    println!("Session details:");
    println!(
        "- id: {}",
        path.file_stem()
            .map_or_else(String::new, |stem| stem.to_string_lossy().into_owned())
    );
    println!("- path: {}", path.display());
    println!("- updated: {updated_unix}");
    println!("- size_bytes: {bytes}");
    println!("- messages: {}", session.messages.len());
    println!("- total_tokens: {}", usage.total_tokens());
    for line in usage.summary_lines_for_model("- usage", None) {
        println!("{line}");
    }
    println!("- preview: {}", session_preview(&session));

    if let Some(user_text) = latest_text_for_role(&session, MessageRole::User) {
        println!("- latest_user: {user_text}");
    }
    if let Some(assistant_text) = latest_text_for_role(&session, MessageRole::Assistant) {
        println!("- latest_assistant: {assistant_text}");
    }
}

fn run_repl(model: String) -> Result<(), Box<dyn std::error::Error>> {
    let mut cli = LiveCli::new(model, true)?;
    let editor = input::LineEditor::new("› ");
    println!("Rusty Claude CLI interactive mode");
    println!("Type /help for commands. Shift+Enter or Ctrl+J inserts a newline.");

    while let Some(input) = editor.read_line()? {
        let trimmed = input.trim();
        if trimmed.is_empty() {
            continue;
        }
        match trimmed {
            "/exit" | "/quit" => break,
            "/help" => {
                println!("Available commands:");
                println!("  /help         Show help");
                println!("  /status       Show session status");
                println!("  /tools        Show tool catalog and permission policy");
                println!("  /permissions  Show permission mode details");
                println!("  /compact      Compact session history");
                println!("  /exit         Quit the REPL");
            }
            "/status" => cli.print_status(),
            "/tools" => cli.print_tools(),
            "/permissions" => cli.print_permissions(),
            "/compact" => cli.compact()?,
            _ => cli.run_turn(trimmed)?,
        }
    }

    Ok(())
}

struct LiveCli {
    model: String,
    system_prompt: Vec<String>,
    runtime: ConversationRuntime<AnthropicRuntimeClient, CliToolExecutor>,
    session_path: PathBuf,
    permission_policy: PermissionPolicy,
}

impl LiveCli {
    fn new(model: String, enable_tools: bool) -> Result<Self, Box<dyn std::error::Error>> {
        let system_prompt = build_system_prompt()?;
        let session_path = new_session_path()?;
        let permission_policy = permission_policy_from_env();
        let runtime = build_runtime(
            Session::new(),
            model.clone(),
            system_prompt.clone(),
            enable_tools,
            permission_policy.clone(),
        )?;
        Ok(Self {
            model,
            system_prompt,
            runtime,
            session_path,
            permission_policy,
        })
    }

    fn run_turn(&mut self, input: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut spinner = Spinner::new();
        let mut stdout = io::stdout();
        spinner.tick(
            "Waiting for Claude",
            TerminalRenderer::new().color_theme(),
            &mut stdout,
        )?;
        let mut permission_prompter = CliPermissionPrompter::new();
        let result = self.runtime.run_turn(input, Some(&mut permission_prompter));
        match result {
            Ok(turn) => {
                spinner.finish(
                    "Claude response complete",
                    TerminalRenderer::new().color_theme(),
                    &mut stdout,
                )?;
                println!();
                self.persist_session()?;
                self.print_turn_usage(turn.usage);
                Ok(())
            }
            Err(error) => {
                spinner.fail(
                    "Claude request failed",
                    TerminalRenderer::new().color_theme(),
                    &mut stdout,
                )?;
                Err(Box::new(error))
            }
        }
    }

    fn print_status(&self) {
        let usage = self.runtime.usage().cumulative_usage();
        println!(
            "status: messages={} turns={} estimated_session_tokens={}",
            self.runtime.session().messages.len(),
            self.runtime.usage().turns(),
            self.runtime.estimated_tokens()
        );
        for line in usage.summary_lines_for_model("usage", Some(&self.model)) {
            println!("{line}");
        }
    }

    fn print_turn_usage(&self, cumulative_usage: TokenUsage) {
        let latest = self.runtime.usage().current_turn_usage();
        println!("\nTurn usage:");
        for line in latest.summary_lines_for_model("  latest", Some(&self.model)) {
            println!("{line}");
        }
        println!("Cumulative usage:");
        for line in cumulative_usage.summary_lines_for_model("  total", Some(&self.model)) {
            println!("{line}");
        }
    }

    fn print_permissions(&self) {
        let mode = env::var("RUSTY_CLAUDE_PERMISSION_MODE")
            .unwrap_or_else(|_| "workspace-write".to_string());
        println!("Permission mode: {mode}");
        println!(
            "Default policy: {}",
            permission_mode_label(self.permission_policy.mode_for("bash"))
        );
        println!("Read-only safe tools stay auto-allowed when read-only mode is active.");
        println!("Interactive approvals appear when permission mode is set to prompt.");
    }

    fn print_tools(&self) {
        println!("Tool catalog:");
        for spec in mvp_tool_specs() {
            let mode = self.permission_policy.mode_for(spec.name);
            let summary = summarize_tool_schema(&spec.input_schema);
            println!(
                "- {} [{}] — {}{}",
                spec.name,
                permission_mode_label(mode),
                spec.description,
                if summary.is_empty() {
                    String::new()
                } else {
                    format!(" | args: {summary}")
                }
            );
        }
    }

    fn compact(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let estimated_before = self.runtime.estimated_tokens();
        let result = self.runtime.compact(CompactionConfig::default());
        let removed = result.removed_message_count;
        let estimated_after = estimate_session_tokens(&result.compacted_session);
        let formatted_summary = result.formatted_summary.clone();
        let compacted_session = result.compacted_session;

        self.runtime = build_runtime(
            compacted_session,
            self.model.clone(),
            self.system_prompt.clone(),
            true,
            self.permission_policy.clone(),
        )?;

        if removed == 0 {
            println!("Compaction skipped: session is below the compaction threshold.");
        } else {
            println!("Compacted {removed} messages into a resumable system summary.");
            if !formatted_summary.is_empty() {
                println!("\n{formatted_summary}");
            }
            let estimated_saved = estimated_before.saturating_sub(estimated_after);
            println!("Estimated tokens saved: {estimated_saved}");
        }
        self.persist_session()?;
        Ok(())
    }

    fn persist_session(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.runtime.session().save_to_path(&self.session_path)?;
        Ok(())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SessionListEntry {
    id: String,
    path: PathBuf,
    updated_unix: u64,
    message_count: usize,
    total_tokens: u32,
    preview: String,
}

fn new_session_path() -> io::Result<PathBuf> {
    let session_dir = default_session_dir()?;
    fs::create_dir_all(&session_dir)?;
    let timestamp = current_unix_timestamp();
    let process_id = std::process::id();
    Ok(session_dir.join(format!("session-{timestamp}-{process_id}.json")))
}

fn default_session_dir() -> io::Result<PathBuf> {
    Ok(env::current_dir()?.join(".rusty-claude").join("sessions"))
}

fn current_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
}

fn resolve_session_target(target: &str) -> io::Result<PathBuf> {
    let direct_path = PathBuf::from(target);
    if direct_path.is_file() {
        return Ok(direct_path);
    }

    let entries = load_session_entries(None, usize::MAX)?;
    if target == "latest" {
        return entries
            .into_iter()
            .next()
            .map(|entry| entry.path)
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "no saved sessions found"));
    }

    let mut matches = entries
        .into_iter()
        .filter(|entry| entry.id.contains(target) || entry.preview.contains(target))
        .collect::<Vec<_>>();
    if matches.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("no saved session matched '{target}'"),
        ));
    }
    matches.sort_by(|left, right| right.updated_unix.cmp(&left.updated_unix));
    Ok(matches.remove(0).path)
}

fn load_session_entries(query: Option<&str>, limit: usize) -> io::Result<Vec<SessionListEntry>> {
    let session_dir = default_session_dir()?;
    if !session_dir.exists() {
        return Ok(Vec::new());
    }

    let query = query.map(str::to_lowercase);
    let mut entries = Vec::new();
    for entry in fs::read_dir(session_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }

        let Ok(session) = Session::load_from_path(&path) else {
            continue;
        };

        let preview = session_preview(&session);
        let id = path
            .file_stem()
            .map_or_else(String::new, |stem| stem.to_string_lossy().into_owned());
        let searchable = format!("{} {}", id.to_lowercase(), preview.to_lowercase());
        if let Some(query) = &query {
            if !searchable.contains(query) {
                continue;
            }
        }

        let updated_unix = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map_or(0, |duration| duration.as_secs());

        entries.push(SessionListEntry {
            id,
            path,
            updated_unix,
            message_count: session.messages.len(),
            total_tokens: runtime::UsageTracker::from_session(&session)
                .cumulative_usage()
                .total_tokens(),
            preview,
        });
    }

    entries.sort_by(|left, right| right.updated_unix.cmp(&left.updated_unix));
    if limit < entries.len() {
        entries.truncate(limit);
    }
    Ok(entries)
}

fn session_preview(session: &Session) -> String {
    for message in session.messages.iter().rev() {
        for block in &message.blocks {
            if let ContentBlock::Text { text } = block {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return truncate_preview(trimmed, 80);
                }
            }
        }
    }
    "No text preview available".to_string()
}

fn latest_text_for_role(session: &Session, role: MessageRole) -> Option<String> {
    session.messages.iter().rev().find_map(|message| {
        if message.role != role {
            return None;
        }
        message.blocks.iter().find_map(|block| match block {
            ContentBlock::Text { text } => {
                let trimmed = text.trim();
                (!trimmed.is_empty()).then(|| truncate_preview(trimmed, 120))
            }
            ContentBlock::ToolUse { .. } | ContentBlock::ToolResult { .. } => None,
        })
    })
}

fn truncate_preview(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let mut output = text.chars().take(max_chars).collect::<String>();
    output.push('…');
    output
}

fn build_system_prompt() -> Result<Vec<String>, Box<dyn std::error::Error>> {
    Ok(load_system_prompt(
        env::current_dir()?,
        DEFAULT_DATE,
        env::consts::OS,
        "unknown",
    )?)
}

fn build_runtime(
    session: Session,
    model: String,
    system_prompt: Vec<String>,
    enable_tools: bool,
    permission_policy: PermissionPolicy,
) -> Result<ConversationRuntime<AnthropicRuntimeClient, CliToolExecutor>, Box<dyn std::error::Error>>
{
    Ok(ConversationRuntime::new(
        session,
        AnthropicRuntimeClient::new(model, enable_tools)?,
        CliToolExecutor::new(),
        permission_policy,
        system_prompt,
    ))
}

struct AnthropicRuntimeClient {
    runtime: tokio::runtime::Runtime,
    client: AnthropicClient,
    model: String,
    enable_tools: bool,
}

impl AnthropicRuntimeClient {
    fn new(model: String, enable_tools: bool) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            runtime: tokio::runtime::Runtime::new()?,
            client: AnthropicClient::from_env()?,
            model,
            enable_tools,
        })
    }
}

impl ApiClient for AnthropicRuntimeClient {
    #[allow(clippy::too_many_lines)]
    fn stream(&mut self, request: ApiRequest) -> Result<Vec<AssistantEvent>, RuntimeError> {
        let message_request = MessageRequest {
            model: self.model.clone(),
            max_tokens: DEFAULT_MAX_TOKENS,
            messages: convert_messages(&request.messages),
            system: (!request.system_prompt.is_empty()).then(|| request.system_prompt.join("\n\n")),
            tools: self.enable_tools.then(|| {
                mvp_tool_specs()
                    .into_iter()
                    .map(|spec| ToolDefinition {
                        name: spec.name.to_string(),
                        description: Some(spec.description.to_string()),
                        input_schema: spec.input_schema,
                    })
                    .collect()
            }),
            tool_choice: self.enable_tools.then_some(ToolChoice::Auto),
            stream: true,
        };

        self.runtime.block_on(async {
            let mut stream = self
                .client
                .stream_message(&message_request)
                .await
                .map_err(|error| RuntimeError::new(error.to_string()))?;
            let mut stdout = io::stdout();
            let mut events = Vec::new();
            let mut pending_tool: Option<(String, String, String)> = None;
            let mut saw_stop = false;

            while let Some(event) = stream
                .next_event()
                .await
                .map_err(|error| RuntimeError::new(error.to_string()))?
            {
                match event {
                    ApiStreamEvent::MessageStart(start) => {
                        for block in start.message.content {
                            push_output_block(block, &mut stdout, &mut events, &mut pending_tool)?;
                        }
                    }
                    ApiStreamEvent::ContentBlockStart(start) => {
                        push_output_block(
                            start.content_block,
                            &mut stdout,
                            &mut events,
                            &mut pending_tool,
                        )?;
                    }
                    ApiStreamEvent::ContentBlockDelta(delta) => match delta.delta {
                        ContentBlockDelta::TextDelta { text } => {
                            if !text.is_empty() {
                                write!(stdout, "{text}")
                                    .and_then(|()| stdout.flush())
                                    .map_err(|error| RuntimeError::new(error.to_string()))?;
                                events.push(AssistantEvent::TextDelta(text));
                            }
                        }
                        ContentBlockDelta::InputJsonDelta { partial_json } => {
                            if let Some((_, _, input)) = &mut pending_tool {
                                input.push_str(&partial_json);
                            }
                        }
                    },
                    ApiStreamEvent::ContentBlockStop(_) => {
                        if let Some((id, name, input)) = pending_tool.take() {
                            events.push(AssistantEvent::ToolUse { id, name, input });
                        }
                    }
                    ApiStreamEvent::MessageDelta(delta) => {
                        events.push(AssistantEvent::Usage(TokenUsage {
                            input_tokens: delta.usage.input_tokens,
                            output_tokens: delta.usage.output_tokens,
                            cache_creation_input_tokens: 0,
                            cache_read_input_tokens: 0,
                        }));
                    }
                    ApiStreamEvent::MessageStop(_) => {
                        saw_stop = true;
                        events.push(AssistantEvent::MessageStop);
                    }
                }
            }

            if !saw_stop
                && events.iter().any(|event| {
                    matches!(event, AssistantEvent::TextDelta(text) if !text.is_empty())
                        || matches!(event, AssistantEvent::ToolUse { .. })
                })
            {
                events.push(AssistantEvent::MessageStop);
            }

            if events
                .iter()
                .any(|event| matches!(event, AssistantEvent::MessageStop))
            {
                return Ok(events);
            }

            let response = self
                .client
                .send_message(&MessageRequest {
                    stream: false,
                    ..message_request.clone()
                })
                .await
                .map_err(|error| RuntimeError::new(error.to_string()))?;
            response_to_events(response, &mut stdout)
        })
    }
}

fn push_output_block(
    block: OutputContentBlock,
    out: &mut impl Write,
    events: &mut Vec<AssistantEvent>,
    pending_tool: &mut Option<(String, String, String)>,
) -> Result<(), RuntimeError> {
    match block {
        OutputContentBlock::Text { text } => {
            if !text.is_empty() {
                write!(out, "{text}")
                    .and_then(|()| out.flush())
                    .map_err(|error| RuntimeError::new(error.to_string()))?;
                events.push(AssistantEvent::TextDelta(text));
            }
        }
        OutputContentBlock::ToolUse { id, name, input } => {
            *pending_tool = Some((id, name, input.to_string()));
        }
    }
    Ok(())
}

fn response_to_events(
    response: MessageResponse,
    out: &mut impl Write,
) -> Result<Vec<AssistantEvent>, RuntimeError> {
    let mut events = Vec::new();
    let mut pending_tool = None;

    for block in response.content {
        push_output_block(block, out, &mut events, &mut pending_tool)?;
        if let Some((id, name, input)) = pending_tool.take() {
            events.push(AssistantEvent::ToolUse { id, name, input });
        }
    }

    events.push(AssistantEvent::Usage(TokenUsage {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
        cache_read_input_tokens: response.usage.cache_read_input_tokens,
    }));
    events.push(AssistantEvent::MessageStop);
    Ok(events)
}

fn permission_mode_label(mode: PermissionMode) -> &'static str {
    match mode {
        PermissionMode::Allow => "allow",
        PermissionMode::Deny => "deny",
        PermissionMode::Prompt => "prompt",
    }
}

fn summarize_tool_schema(schema: &serde_json::Value) -> String {
    let Some(properties) = schema
        .get("properties")
        .and_then(serde_json::Value::as_object)
    else {
        return String::new();
    };
    let mut keys = properties.keys().cloned().collect::<Vec<_>>();
    keys.sort();
    keys.join(", ")
}

fn summarize_tool_output(tool_name: &str, output: &str) -> String {
    let compact = output.replace('\n', " ");
    let preview = truncate_preview(compact.trim(), 120);
    if preview.is_empty() {
        format!("{tool_name} completed with no textual output")
    } else {
        format!("{tool_name} → {preview}")
    }
}

struct CliPermissionPrompter {
    prompt: String,
}

impl CliPermissionPrompter {
    fn new() -> Self {
        Self {
            prompt: "Allow tool? [y]es / [n]o / [a]lways deny this run: ".to_string(),
        }
    }
}

impl PermissionPrompter for CliPermissionPrompter {
    fn decide(&mut self, request: &PermissionRequest) -> PermissionPromptDecision {
        println!(
            "
Tool permission request:"
        );
        println!("- tool: {}", request.tool_name);
        println!("- input: {}", truncate_preview(request.input.trim(), 200));
        print!("{}", self.prompt);
        let _ = io::stdout().flush();

        let mut response = String::new();
        match io::stdin().read_line(&mut response) {
            Ok(_) => match response.trim().to_ascii_lowercase().as_str() {
                "y" | "yes" => PermissionPromptDecision::Allow,
                "a" | "always" => PermissionPromptDecision::Deny {
                    reason: "tool denied for this run by user".to_string(),
                },
                _ => PermissionPromptDecision::Deny {
                    reason: "tool denied by user".to_string(),
                },
            },
            Err(error) => PermissionPromptDecision::Deny {
                reason: format!("tool approval failed: {error}"),
            },
        }
    }
}

struct CliToolExecutor {
    renderer: TerminalRenderer,
}

impl CliToolExecutor {
    fn new() -> Self {
        Self {
            renderer: TerminalRenderer::new(),
        }
    }
}

impl ToolExecutor for CliToolExecutor {
    fn execute(&mut self, tool_name: &str, input: &str) -> Result<String, ToolError> {
        let value = serde_json::from_str(input)
            .map_err(|error| ToolError::new(format!("invalid tool input JSON: {error}")))?;
        match execute_tool(tool_name, &value) {
            Ok(output) => {
                let summary = summarize_tool_output(tool_name, &output);
                let markdown = format!(
                    "### Tool `{tool_name}`\n\n- Summary: {summary}\n\n```json\n{output}\n```\n"
                );
                self.renderer
                    .stream_markdown(&markdown, &mut io::stdout())
                    .map_err(|error| ToolError::new(error.to_string()))?;
                Ok(output)
            }
            Err(error) => Err(ToolError::new(error)),
        }
    }
}

fn permission_policy_from_env() -> PermissionPolicy {
    let mode =
        env::var("RUSTY_CLAUDE_PERMISSION_MODE").unwrap_or_else(|_| "workspace-write".to_string());
    match mode.as_str() {
        "read-only" => PermissionPolicy::new(PermissionMode::Deny)
            .with_tool_mode("read_file", PermissionMode::Allow)
            .with_tool_mode("glob_search", PermissionMode::Allow)
            .with_tool_mode("grep_search", PermissionMode::Allow),
        "prompt" => PermissionPolicy::new(PermissionMode::Prompt)
            .with_tool_mode("read_file", PermissionMode::Allow)
            .with_tool_mode("glob_search", PermissionMode::Allow)
            .with_tool_mode("grep_search", PermissionMode::Allow),
        _ => PermissionPolicy::new(PermissionMode::Allow),
    }
}

fn convert_messages(messages: &[ConversationMessage]) -> Vec<InputMessage> {
    messages
        .iter()
        .filter_map(|message| {
            let role = match message.role {
                MessageRole::System | MessageRole::User | MessageRole::Tool => "user",
                MessageRole::Assistant => "assistant",
            };
            let content = message
                .blocks
                .iter()
                .map(|block| match block {
                    ContentBlock::Text { text } => InputContentBlock::Text { text: text.clone() },
                    ContentBlock::ToolUse { id, name, input } => InputContentBlock::ToolUse {
                        id: id.clone(),
                        name: name.clone(),
                        input: serde_json::from_str(input)
                            .unwrap_or_else(|_| serde_json::json!({ "raw": input })),
                    },
                    ContentBlock::ToolResult {
                        tool_use_id,
                        output,
                        is_error,
                        ..
                    } => InputContentBlock::ToolResult {
                        tool_use_id: tool_use_id.clone(),
                        content: vec![ToolResultContentBlock::Text {
                            text: output.clone(),
                        }],
                        is_error: *is_error,
                    },
                })
                .collect::<Vec<_>>();
            (!content.is_empty()).then(|| InputMessage {
                role: role.to_string(),
                content,
            })
        })
        .collect()
}

fn print_help() {
    println!("rusty-claude-cli");
    println!();
    println!("Usage:");
    println!("  rusty-claude-cli [--model MODEL]             Start interactive REPL");
    println!(
        "  rusty-claude-cli [--model MODEL] prompt TEXT Send one prompt and stream the response"
    );
    println!("  rusty-claude-cli dump-manifests");
    println!("  rusty-claude-cli bootstrap-plan");
    println!("  rusty-claude-cli sessions [--query TEXT] [--limit N]");
    println!("  rusty-claude-cli session <latest|SESSION|PATH>");
    println!("  rusty-claude-cli resume <latest|SESSION|PATH> [/compact]");
    println!("  env RUSTY_CLAUDE_PERMISSION_MODE=prompt enables interactive tool approval");
    println!("  rusty-claude-cli system-prompt [--cwd PATH] [--date YYYY-MM-DD]");
    println!("  rusty-claude-cli --resume SESSION.json [/compact]");
}

#[cfg(test)]
mod tests {
    use super::{parse_args, resolve_session_target, session_preview, CliAction, DEFAULT_MODEL};
    use runtime::{ContentBlock, ConversationMessage, MessageRole, Session};
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn defaults_to_repl_when_no_args() {
        assert_eq!(
            parse_args(&[]).expect("args should parse"),
            CliAction::Repl {
                model: DEFAULT_MODEL.to_string(),
            }
        );
    }

    #[test]
    fn parses_prompt_subcommand() {
        let args = vec![
            "prompt".to_string(),
            "hello".to_string(),
            "world".to_string(),
        ];
        assert_eq!(
            parse_args(&args).expect("args should parse"),
            CliAction::Prompt {
                prompt: "hello world".to_string(),
                model: DEFAULT_MODEL.to_string(),
            }
        );
    }

    #[test]
    fn parses_system_prompt_options() {
        let args = vec![
            "system-prompt".to_string(),
            "--cwd".to_string(),
            "/tmp/project".to_string(),
            "--date".to_string(),
            "2026-04-01".to_string(),
        ];
        assert_eq!(
            parse_args(&args).expect("args should parse"),
            CliAction::PrintSystemPrompt {
                cwd: PathBuf::from("/tmp/project"),
                date: "2026-04-01".to_string(),
            }
        );
    }

    #[test]
    fn parses_resume_flag_with_slash_command() {
        let args = vec![
            "--resume".to_string(),
            "session.json".to_string(),
            "/compact".to_string(),
        ];
        assert_eq!(
            parse_args(&args).expect("args should parse"),
            CliAction::ResumeSession {
                session_path: PathBuf::from("session.json"),
                command: Some("/compact".to_string()),
            }
        );
    }

    #[test]
    fn parses_session_inspect_subcommand() {
        let args = vec!["session".to_string(), "latest".to_string()];
        assert_eq!(
            parse_args(&args).expect("args should parse"),
            CliAction::InspectSession {
                target: "latest".to_string(),
            }
        );
    }

    #[test]
    fn parses_sessions_subcommand() {
        let args = vec![
            "sessions".to_string(),
            "--query".to_string(),
            "compact".to_string(),
            "--limit".to_string(),
            "5".to_string(),
        ];
        assert_eq!(
            parse_args(&args).expect("args should parse"),
            CliAction::ListSessions {
                query: Some("compact".to_string()),
                limit: 5,
            }
        );
    }

    #[test]
    fn parses_named_resume_subcommand() {
        let args = vec![
            "resume".to_string(),
            "latest".to_string(),
            "/compact".to_string(),
        ];
        assert_eq!(
            parse_args(&args).expect("args should parse"),
            CliAction::ResumeNamed {
                target: "latest".to_string(),
                command: Some("/compact".to_string()),
            }
        );
    }

    #[test]
    fn converts_tool_roundtrip_messages() {
        let messages = vec![
            ConversationMessage::user_text("hello"),
            ConversationMessage::assistant(vec![ContentBlock::ToolUse {
                id: "tool-1".to_string(),
                name: "bash".to_string(),
                input: "{\"command\":\"pwd\"}".to_string(),
            }]),
            ConversationMessage {
                role: MessageRole::Tool,
                blocks: vec![ContentBlock::ToolResult {
                    tool_use_id: "tool-1".to_string(),
                    tool_name: "bash".to_string(),
                    output: "ok".to_string(),
                    is_error: false,
                }],
                usage: None,
            },
        ];

        let converted = super::convert_messages(&messages);
        assert_eq!(converted.len(), 3);
        assert_eq!(converted[1].role, "assistant");
        assert_eq!(converted[2].role, "user");
    }

    #[test]
    fn builds_preview_from_latest_text_block() {
        let session = Session {
            version: 1,
            messages: vec![
                ConversationMessage::user_text("first"),
                ConversationMessage::assistant(vec![ContentBlock::Text {
                    text: "latest preview".to_string(),
                }]),
            ],
        };
        assert_eq!(session_preview(&session), "latest preview");
    }

    #[test]
    fn resolves_direct_session_path() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |duration| duration.as_nanos());
        let path = std::env::temp_dir().join(format!("rusty-claude-session-{unique}.json"));
        fs::write(&path, "{\"version\":1,\"messages\":[]}").expect("temp session");
        let resolved = resolve_session_target(path.to_string_lossy().as_ref()).expect("resolve");
        assert_eq!(resolved, path);
        fs::remove_file(resolved).expect("cleanup");
    }
}
