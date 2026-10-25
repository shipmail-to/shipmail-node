import type { DomainStatus, PaginationParams } from "./common.js";

export type Domain = {
  readonly object: "domain";
  readonly id: string;
  readonly name: string;
  readonly status: DomainStatus;
  readonly managed_by: "external" | "shipmail";
  readonly dns_provider: string | null;
  readonly mx_verified: boolean;
  readonly spf_verified: boolean;
  readonly dkim_verified: boolean;
  readonly dmarc_verified: boolean;
  readonly dmarc_managed_externally: boolean;
  readonly outbound_verified: boolean;
  readonly catch_all_mailbox_id: string | null;
  readonly verified_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly registration?: DomainRegistrationInfo | undefined;
};

export type CreateDomainParams = {
  readonly name: string;
};

export type UpdateDomainParams = {
  readonly catch_all_mailbox_id: string | null;
};

export type ListDomainsParams = PaginationParams;

export type DomainVerificationResult = {
  readonly all_verified: boolean;
  readonly records: {
    readonly mx: boolean;
    readonly spf: boolean;
    readonly dkim: boolean;
    readonly dmarc: boolean;
  };
  readonly outbound_verified: boolean;
  readonly outbound_error: boolean;
  readonly existing_spf: string | null;
  readonly suggested_spf: string | null;
  readonly conflicting_mx: readonly string[];
  readonly dmarc_valid: boolean;
  readonly dmarc_exact_match: boolean;
  readonly dmarc_record_value: string | null;
  readonly dmarc_managed_externally: boolean;
};

export type DomainDnsRecordKey = "mx" | "spf" | "mail_from_mx" | "mail_from_spf" | "dkim" | "dmarc";

export type DomainDnsRecordStatus = "verified" | "not_found" | "mismatch" | "pending";

export type DomainDnsRecord = {
  readonly key: DomainDnsRecordKey;
  readonly type: "MX" | "TXT";
  readonly host: string;
  readonly value: string | null;
  readonly priority: number | null;
  readonly ttl: number;
  readonly status: DomainDnsRecordStatus;
  readonly found_values: readonly string[];
};

export type DomainDnsRecordSet = {
  readonly object: "dns_record_set";
  readonly domain_id: string;
  readonly domain_name: string;
  readonly all_verified: boolean;
  readonly checked_at: string;
  readonly records: readonly DomainDnsRecord[];
};

export type DomainHealthProvider = "google" | "microsoft" | "yahoo" | "apple" | "other";

export type DomainHealthProviderDelivery = {
  readonly provider: DomainHealthProvider;
  readonly recipients: number;
  readonly delivered: number;
  readonly bounced: number;
  readonly deferred: number;
  readonly complained: number;
  readonly delivery_rate: number | null;
};

export type DomainHealth = {
  readonly object: "domain_health";
  readonly domain_id: string;
  readonly domain: string;
  readonly generated_at: string;
  readonly dns: {
    readonly mx: boolean;
    readonly spf: boolean;
    readonly dkim: boolean;
    readonly dmarc: boolean;
    readonly last_checked_at: string | null;
  };
  readonly blocklist: {
    readonly list: "spamhaus_dbl";
    readonly listed: boolean;
    readonly listed_since: string | null;
  };
  readonly delivery: {
    readonly since: string;
    readonly until: string;
    readonly recipients: number;
    readonly delivered: number;
    readonly bounced: number;
    readonly deferred: number;
    readonly complained: number;
    readonly failed: number;
    readonly suppressed: number;
    readonly queued: number;
    readonly sent: number;
    readonly delivery_rate: number | null;
    readonly providers: readonly DomainHealthProviderDelivery[];
  };
};

export type DomainSearchResult = {
  readonly domain_name: string;
  readonly available: boolean;
  readonly purchase_price: number | null;
  readonly renewal_price: number | null;
  readonly currency: string;
  readonly premium: boolean;
};

export type SearchDomainsParams = {
  readonly keyword: string;
};

export type RegistrationContact = {
  readonly first_name: string;
  readonly last_name: string;
  readonly address1: string;
  readonly address2?: string | undefined;
  readonly city: string;
  readonly state?: string | undefined;
  readonly zip: string;
  readonly country: string;
  readonly phone: string;
  readonly email: string;
};

export type RegisterDomainParams = {
  readonly name: string;
  readonly years?: number | undefined;
  readonly contact: RegistrationContact;
};

export type DomainRegistrationInfo = {
  readonly expires_at: string;
  readonly auto_renew: boolean;
  readonly renewal_price: number;
  readonly privacy_enabled: boolean;
  readonly currency: string;
  readonly registered_at: string;
};
