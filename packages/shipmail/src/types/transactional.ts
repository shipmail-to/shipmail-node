export type TransactionalDomainStatus = "pending" | "verifying" | "verified" | "failed";

export type TransactionalDnsRecordStatus = "pending" | "verified" | "failed";

export type TransactionalDnsRecord = {
  readonly key: string;
  readonly type: string;
  readonly host: string;
  readonly value: string;
  readonly priority: number | null;
  readonly ttl: number | null;
  readonly description: string;
  readonly status: TransactionalDnsRecordStatus;
};

// `dns_records` is empty until setup finishes. Create it again with the same values to resume.
export type TransactionalDomain = {
  readonly object: "transactional_domain";
  readonly id: string;
  readonly name: string;
  readonly root_domain: string;
  readonly status: TransactionalDomainStatus;
  readonly mail_from_domain: string;
  readonly dns_records: readonly TransactionalDnsRecord[];
  readonly verified_at: string | null;
  readonly created_at: string;
};

export type TransactionalDomainList = {
  readonly object: "list";
  readonly data: readonly TransactionalDomain[];
};

export type CreateTransactionalDomainParams = {
  /** A verified domain of the organization, such as `example.com`. */
  readonly root_domain: string;
  /** One DNS label: `mail` sends from `mail.example.com`. */
  readonly subdomain: string;
};

export type TransactionalSenderState = "active" | "disabled" | "revoked";

export type TransactionalSender = {
  readonly object: "transactional_sender";
  readonly id: string;
  readonly from: string;
  readonly display_name: string;
  readonly domain_id: string | null;
  readonly mailbox_id: string;
  readonly reply_to: string;
  readonly state: TransactionalSenderState;
  readonly refuse_disposable: boolean;
  readonly smtp_enabled: boolean;
  readonly created_at: string;
};

export type TransactionalSenderList = {
  readonly object: "list";
  readonly data: readonly TransactionalSender[];
};

export type ListTransactionalSendersParams = {
  readonly domain_id?: string | undefined;
};

export type CreateTransactionalSenderParams = {
  readonly domain_id: string;
  /** The mailbox that receives replies. Its address becomes the sender's Reply-To. */
  readonly mailbox_id: string;
  /** The part before `@`: `hello` sends from `hello@mail.example.com`. */
  readonly local_part: string;
  readonly display_name: string;
};

// At least one field. A move applies first, then `state`, then `refuse_disposable`.
export type UpdateTransactionalSenderParams = {
  readonly state?: "active" | "disabled" | undefined;
  readonly mailbox_id?: string | undefined;
  readonly refuse_disposable?: boolean | undefined;
};
