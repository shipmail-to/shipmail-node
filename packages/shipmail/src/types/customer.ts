export type CustomerIdentifierKind = "email" | "domain";

export type CustomerFieldValue = string | number | boolean;

export type CustomerIdentifier = {
  readonly kind: CustomerIdentifierKind;
  readonly value: string;
};

export type CustomerExternalId = {
  /** Lowercase slug of the system that knows the customer, such as `hubspot` or `stripe`. */
  readonly source: string;
  readonly external_id: string;
  readonly url: string | null;
};

export type Customer = {
  readonly object: "customer";
  readonly id: string;
  readonly name: string | null;
  readonly company: string | null;
  readonly notes: string | null;
  /** The reply time this customer gets. Null means the mailbox default. */
  readonly service_level_id: string | null;
  readonly fields: Readonly<Record<string, CustomerFieldValue>>;
  /** Free-form labels such as `vip`, stored lowercase. Empty when the customer has none. */
  readonly tags: readonly string[];
  readonly identifiers: readonly CustomerIdentifier[];
  readonly external_ids: readonly CustomerExternalId[];
  readonly created_at: string;
  readonly updated_at: string;
};

export type ListCustomersParams = {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  /** Exact email address identifier. */
  readonly email?: string | undefined;
  /** Exact domain identifier. */
  readonly domain?: string | undefined;
  /** Give with `external_id`. */
  readonly external_source?: string | undefined;
  readonly external_id?: string | undefined;
  /** Searches name, company and identifiers. */
  readonly q?: string | undefined;
  /** Customers with this tag, matched after normalization, so `VIP` finds `vip`. */
  readonly tag?: string | undefined;
};

type CustomerProfileParams = {
  readonly name?: string | null | undefined;
  readonly company?: string | null | undefined;
  readonly notes?: string | null | undefined;
  readonly service_level_id?: string | null | undefined;
  readonly fields?: Readonly<Record<string, CustomerFieldValue>> | undefined;
  /**
   * Replaces the whole list when given; trimmed, lowercased and deduplicated. At most 20 tags of 1
   * to 32 characters, without commas.
   */
  readonly tags?: readonly string[] | undefined;
  /** Replaces the whole set when given. */
  readonly identifiers?: readonly CustomerIdentifier[] | undefined;
};

export type CreateCustomerParams = CustomerProfileParams & {
  /** Replaces the whole set when given. */
  readonly external_ids?:
    | readonly {
        readonly source: string;
        readonly external_id: string;
        readonly url?: string | null | undefined;
      }[]
    | undefined;
};

export type UpdateCustomerParams = CreateCustomerParams;

export type UpsertCustomerParams = CustomerProfileParams & {
  /** Link to the record in the external system. */
  readonly url?: string | null | undefined;
};

export type ServiceLevel = {
  readonly object: "service_level";
  readonly id: string;
  readonly name: string;
  readonly reply_target_minutes: number;
  /** Null when the clock runs around the clock. */
  readonly business_hours: {
    readonly time_zone: string;
    readonly days: readonly {
      /** 0 is Sunday. */
      readonly day: number;
      readonly start: string;
      readonly end: string;
    }[];
  } | null;
  readonly position: number;
  readonly created_at: string;
  readonly updated_at: string;
};

export type CustomerFieldType = "text" | "number" | "date" | "url" | "boolean";

export type CustomerField = {
  readonly object: "customer_field";
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly type: CustomerFieldType;
  readonly position: number;
  readonly created_at: string;
  readonly updated_at: string;
};

export type ReplyTargetState = "on_track" | "at_risk" | "missed";

export type ReplyTarget = {
  readonly state: ReplyTargetState;
  readonly service_level_id: string | null;
  readonly started_at: string;
  readonly warn_at: string;
  readonly due_at: string;
};
