import type { PaginationParams } from "./common.js";

// Value per `{{key}}`. Inserted as text: HTML-escaped in html, control characters removed in the subject.
export type TemplateVariableValues = Readonly<Record<string, string | number | boolean>>;

export type TemplateVariable = {
  readonly key: string;
  // True when the key has no fallback, so every send must pass it.
  readonly required: boolean;
  readonly fallback: string | null;
};

// subject, html, text and fallbacks are the draft. A send uses the published version.
export type Template = {
  readonly object: "template";
  readonly id: string;
  readonly name: string;
  readonly subject: string;
  readonly html: string | null;
  readonly text: string | null;
  readonly fallbacks: Readonly<Record<string, string>>;
  readonly variables: readonly TemplateVariable[];
  // Null until the first publish.
  readonly published_version: number | null;
  readonly has_unpublished_changes: boolean;
  readonly created_at: string;
  readonly updated_at: string;
};

export type TemplateVersion = {
  readonly object: "template_version";
  readonly template_id: string;
  readonly version: number;
  readonly subject: string;
  readonly html: string | null;
  readonly text: string | null;
  readonly fallbacks: Readonly<Record<string, string>>;
  readonly variables: readonly TemplateVariable[];
  readonly published_at: string;
};

export type RenderedTemplate = {
  readonly object: "rendered_template";
  readonly template_id: string;
  // Null when the draft was rendered.
  readonly version: number | null;
  readonly subject: string;
  readonly html: string | null;
  readonly text: string | null;
};

export type ListTemplatesParams = PaginationParams;

export type ListTemplateVersionsParams = PaginationParams;

// At least one of html or text is required.
export type CreateTemplateParams = {
  readonly name: string;
  readonly subject: string;
  readonly html?: string | undefined;
  readonly text?: string | undefined;
  readonly fallbacks?: Readonly<Record<string, string>> | undefined;
  // Also publish the draft as version 1.
  readonly publish?: boolean | undefined;
};

// Changes the draft only. Set html or text to null to remove it; at least one must remain.
export type UpdateTemplateParams = {
  readonly name?: string | undefined;
  readonly subject?: string | undefined;
  readonly html?: string | null | undefined;
  readonly text?: string | null | undefined;
  readonly fallbacks?: Readonly<Record<string, string>> | undefined;
};

export type RenderTemplateParams = {
  readonly variables?: TemplateVariableValues | undefined;
  // Omit to render the draft.
  readonly version?: number | undefined;
};

export type SendMessageTemplate = {
  readonly id: string;
  // Omit to send the published version.
  readonly version?: number | undefined;
  readonly variables?: TemplateVariableValues | undefined;
};
