export type SmtpCredentialPortSecurity = "tls" | "starttls";

export type SmtpCredentialPort = {
  readonly port: number;
  readonly security: SmtpCredentialPortSecurity;
};

// Sends only as `from`, one transactional sender's address.
export type SmtpCredential = {
  readonly object: "smtp_credential";
  readonly id: string;
  readonly from: string;
  readonly name: string;
  readonly username: string;
  readonly host: string;
  readonly ports: readonly SmtpCredentialPort[];
  readonly last_used_at: string | null;
  readonly created_at: string;
};

// The password is returned once. Shipmail keeps no copy.
export type CreatedSmtpCredential = SmtpCredential & {
  readonly password: string;
};

export type SmtpCredentialList = {
  readonly object: "list";
  readonly data: readonly SmtpCredential[];
};

export type ListSmtpCredentialsParams = {
  readonly from?: string | undefined;
};

export type CreateSmtpCredentialParams = {
  readonly from: string;
  readonly name: string;
};
