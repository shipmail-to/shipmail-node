export const MAILBOX_IMPORT_STATUSES = [
  "queued",
  "running",
  "paused_throttle",
  "paused_quota",
  "completed",
  "failed",
  "cancelled",
  "undo_queued",
  "undoing",
  "undone",
  "undo_failed",
] as const;
export type MailboxImportStatus = (typeof MAILBOX_IMPORT_STATUSES)[number];

export const MAILBOX_IMPORT_PROVIDERS = [
  "gmail",
  "outlook",
  "yahoo",
  "aol",
  "icloud",
  "fastmail",
  "zoho",
  "titan",
  "namecheap",
  "migadu",
  "gmx",
  "mail_com",
  "mailbox_org",
  "mxroute",
  "infomaniak",
  "ovh",
  "gandi",
  "imap",
  "takeout",
  "proton",
  "tuta",
  "file",
] as const;
export type MailboxImportProvider = (typeof MAILBOX_IMPORT_PROVIDERS)[number];

// Providers accepted by the API for the imap source type. Outlook imports
// require Sign in with Microsoft and can only be started from the dashboard.
export const MAILBOX_IMPORT_IMAP_PROVIDERS = [
  "gmail",
  "yahoo",
  "aol",
  "icloud",
  "fastmail",
  "zoho",
  "titan",
  "namecheap",
  "migadu",
  "gmx",
  "mail_com",
  "mailbox_org",
  "mxroute",
  "infomaniak",
  "ovh",
  "gandi",
  "imap",
] as const;
export type MailboxImportImapProvider = (typeof MAILBOX_IMPORT_IMAP_PROVIDERS)[number];

export const MAILBOX_IMPORT_FILE_PROVIDERS = ["takeout", "proton", "tuta", "file"] as const;
export type MailboxImportFileProvider = (typeof MAILBOX_IMPORT_FILE_PROVIDERS)[number];

export const MAILBOX_IMPORT_FOLDER_STATES = [
  "pending",
  "importing",
  "completed",
  "failed",
  // The source server refused the folder; the import finished without it.
  "skipped",
] as const;
export type MailboxImportFolderState = (typeof MAILBOX_IMPORT_FOLDER_STATES)[number];

export const MAILBOX_IMPORT_RANGES = ["all", "12m", "3m", "1m"] as const;
export type MailboxImportRange = (typeof MAILBOX_IMPORT_RANGES)[number];

export type MailboxImportKind = "imap" | "file";

export type MailboxImportCounts = {
  readonly found: number;
  readonly imported: number;
  readonly undone: number;
  readonly duplicates_skipped: number;
  readonly oversize_skipped: number;
  readonly failed: number;
  readonly contacts_imported: number;
};

export type MailboxImportBytes = {
  readonly total: number;
  readonly imported: number;
};

export type MailboxImportFolder = {
  readonly source_folder: string;
  readonly target_folder: string | null;
  readonly role: string | null;
  readonly state: MailboxImportFolderState;
  readonly found: number;
  readonly imported: number;
  readonly duplicates: number;
  readonly oversize: number;
  readonly failed: number;
};

export type MailboxImport = {
  readonly object: "import";
  readonly id: string;
  readonly mailbox_id: string;
  readonly kind: MailboxImportKind;
  readonly provider: MailboxImportProvider;
  readonly source_address: string | null;
  readonly status: MailboxImportStatus;
  readonly status_detail: string | null;
  readonly error: string | null;
  readonly resume_at: string | null;
  readonly counts: MailboxImportCounts;
  readonly bytes: MailboxImportBytes;
  readonly created_at: string;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  // Per-folder progress. Returned by getImport only.
  readonly folders?: readonly MailboxImportFolder[] | undefined;
  // Source retention. Returned by getImport only.
  readonly source_retention?: MailboxImportSourceRetention | undefined;
};

export type MailboxImportSourceRetentionState =
  | "available"
  | "missing"
  | "expired"
  | "deleted"
  | "not_applicable";

export type MailboxImportSourceRetention = {
  readonly state: MailboxImportSourceRetentionState;
  readonly expires_at: string | null;
  readonly deleted_at: string | null;
};

export type RestoreMailboxImportParams = {
  readonly file_ids: readonly string[];
};

export type MailboxImports = {
  readonly object: "imports";
  readonly mailbox_id: string;
  readonly data: readonly MailboxImport[];
};

export type MailboxImportImapSource = {
  readonly type: "imap";
  readonly provider: MailboxImportImapProvider;
  readonly email: string;
  readonly password: string;
  readonly host?: string | undefined;
  readonly port?: number | undefined;
};

export type MailboxImportFileSource = {
  readonly type: "files";
  readonly provider: MailboxImportFileProvider;
  readonly file_ids: readonly string[];
};

export type MailboxImportOptions = {
  readonly folders?: readonly string[] | null | undefined;
  readonly range?: MailboxImportRange | undefined;
  readonly include_spam?: boolean | undefined;
  readonly include_trash?: boolean | undefined;
};

export type CreateMailboxImportParams = {
  readonly source: MailboxImportImapSource | MailboxImportFileSource;
  readonly options?: MailboxImportOptions | undefined;
};

export type CreateImportUploadParams = {
  readonly provider: MailboxImportFileProvider;
  readonly file_name: string;
  readonly size_bytes: number;
  readonly source_fingerprint: string;
};

export type ImportUploadPart = {
  readonly part_number: number;
  readonly upload_url: string;
};

export type ImportUpload = {
  readonly object: "import_upload";
  readonly file_id: string;
  readonly part_size_bytes: number;
  readonly completed_parts: readonly CompleteImportUploadPart[];
  readonly parts: readonly ImportUploadPart[];
  readonly expires_in_seconds: number;
};

export type CompleteImportUploadPart = {
  readonly part_number: number;
  readonly etag: string;
};

export type CompleteImportUploadParams = {
  readonly parts: readonly CompleteImportUploadPart[];
};
