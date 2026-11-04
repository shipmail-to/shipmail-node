import { ApiResource } from "../resource.js";
import type { MethodOptions, OneTimeSecretMethodOptions } from "../types/common.js";
import type {
  CreatedSmtpCredential,
  CreateSmtpCredentialParams,
  ListSmtpCredentialsParams,
  SmtpCredentialList,
} from "../types/smtp-credential.js";

export class SmtpCredentials extends ApiResource {
  list(params?: ListSmtpCredentialsParams, options?: MethodOptions): Promise<SmtpCredentialList> {
    return this.client.request<SmtpCredentialList>({
      method: "GET",
      path: "/smtp-credentials",
      query: { from: params?.from },
      methodOptions: options,
    });
  }

  // The password is in this response only. An Idempotency-Key is refused.
  create(
    params: CreateSmtpCredentialParams,
    options?: OneTimeSecretMethodOptions,
  ): Promise<CreatedSmtpCredential> {
    return this.client.request<CreatedSmtpCredential>({
      method: "POST",
      path: "/smtp-credentials",
      body: params,
      methodOptions: options,
    });
  }

  revoke(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/smtp-credentials/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }
}
