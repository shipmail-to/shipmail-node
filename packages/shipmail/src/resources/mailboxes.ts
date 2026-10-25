import { Page } from "../pagination.js";
import { ApiResource } from "../resource.js";
import type {
  MethodOptions,
  OneTimeSecretMethodOptions,
  PaginatedResponse,
} from "../types/common.js";
import type {
  CompleteImportUploadParams,
  CreateImportUploadParams,
  CreateMailboxImportParams,
  ImportUpload,
  MailboxImport,
  MailboxImports,
  RestoreMailboxImportParams,
} from "../types/import.js";
import type {
  CreatedMailboxAppPassword,
  CreateInboxDraftParams,
  CreateInboxReplyDraftParams,
  CreateMailboxAppPasswordParams,
  CreateMailboxFolderParams,
  CreateMailboxForwardingParams,
  CreateMailboxParams,
  DownloadInboxAttachmentParams,
  InboxDraft,
  InboxMessageAction,
  InboxMessages,
  InboxMessageSecurityReview,
  InboxReplyDraft,
  InboxReplyDraftList,
  InboxReplyDraftSend,
  InboxReplyDraftWrite,
  InboxThread,
  InboxThreadAttentionResult,
  InboxThreads,
  ListInboxMessagesParams,
  ListInboxThreadsParams,
  ListMailboxesParams,
  Mailbox,
  MailboxAppPasswordList,
  MailboxDeliveryRouting,
  MailboxExport,
  MailboxFolder,
  MailboxFolders,
  MailboxForwarding,
  MailboxForwardingList,
  MailboxIdentities,
  MailboxRules,
  MoveInboxMessageParams,
  ReleaseInboxMessageSecurityParams,
  ResetMailboxPasswordParams,
  UpdateAutoReplyParams,
  UpdateInboxMessageParams,
  UpdateInboxReplyDraftParams,
  UpdateInboxThreadAttentionParams,
  UpdateMailboxDeliveryRoutingParams,
  UpdateMailboxFolderParams,
  UpdateMailboxParams,
  UpdateMailboxRulesParams,
} from "../types/mailbox.js";
import type {
  InjectSandboxInboundParams,
  Message,
  PrepareStagedAttachmentUploadParams,
  ReplyToMessageParams,
  StageAttachmentParams,
  StagedAttachment,
  StagedAttachmentUpload,
} from "../types/message.js";

export class Mailboxes extends ApiResource {
  prepareStagedAttachmentUpload(
    id: string,
    params: PrepareStagedAttachmentUploadParams,
    options?: OneTimeSecretMethodOptions,
  ): Promise<StagedAttachmentUpload> {
    return this.client.request<StagedAttachmentUpload>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/staged-attachment-upload-tokens`,
      body: params,
      methodOptions: options,
    });
  }

  stageAttachment(
    id: string,
    params: StageAttachmentParams,
    options?: MethodOptions,
  ): Promise<StagedAttachment> {
    return this.client.request<StagedAttachment>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/staged-attachments`,
      query: { filename: params.filename },
      rawBody: params.data,
      contentType: params.content_type,
      methodOptions: options,
    });
  }

  injectSandboxInbound(
    id: string,
    params: InjectSandboxInboundParams,
    options?: MethodOptions,
  ): Promise<Message> {
    return this.client.request<Message>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/sandbox/inbound`,
      body: params,
      methodOptions: options,
    });
  }

  create(params: CreateMailboxParams, options?: MethodOptions): Promise<Mailbox> {
    return this.client.request<Mailbox>({
      method: "POST",
      path: "/mailboxes",
      body: params,
      methodOptions: options,
    });
  }

  list(params?: ListMailboxesParams, options?: MethodOptions): Promise<PaginatedResponse<Mailbox>> {
    return this.client.request<PaginatedResponse<Mailbox>>({
      method: "GET",
      path: "/mailboxes",
      query: {
        domain_id: params?.domain_id,
        cursor: params?.cursor,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  listAutoPaginating(params?: Omit<ListMailboxesParams, "cursor">): Page<Mailbox> {
    return new Page<Mailbox>(this.client, "/mailboxes", {
      domain_id: params?.domain_id,
      limit: params?.limit,
    });
  }

  get(id: string, options?: MethodOptions): Promise<Mailbox> {
    return this.client.request<Mailbox>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  update(id: string, params: UpdateMailboxParams, options?: MethodOptions): Promise<Mailbox> {
    return this.client.request<Mailbox>({
      method: "PATCH",
      path: `/mailboxes/${encodeURIComponent(id)}`,
      body: params,
      methodOptions: options,
    });
  }

  delete(id: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/mailboxes/${encodeURIComponent(id)}`,
      methodOptions: options,
    });
  }

  suspend(id: string, options?: MethodOptions): Promise<Mailbox> {
    return this.client.request<Mailbox>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/suspend`,
      methodOptions: options,
    });
  }

  resume(id: string, options?: MethodOptions): Promise<Mailbox> {
    return this.client.request<Mailbox>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/resume`,
      methodOptions: options,
    });
  }

  createExport(id: string, options?: MethodOptions): Promise<MailboxExport> {
    return this.client.request<MailboxExport>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/exports`,
      methodOptions: options,
    });
  }

  getExport(id: string, exportId: string, options?: MethodOptions): Promise<MailboxExport> {
    return this.client.request<MailboxExport>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/exports/${encodeURIComponent(exportId)}`,
      methodOptions: options,
    });
  }

  listFolders(id: string, options?: MethodOptions): Promise<MailboxFolders> {
    return this.client.request<MailboxFolders>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/folders`,
      methodOptions: options,
    });
  }

  createFolder(
    id: string,
    params: CreateMailboxFolderParams,
    options?: MethodOptions,
  ): Promise<MailboxFolder> {
    return this.client.request<MailboxFolder>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/folders`,
      body: params,
      methodOptions: options,
    });
  }

  updateFolder(
    id: string,
    folderId: string,
    params: UpdateMailboxFolderParams,
    options?: MethodOptions,
  ): Promise<MailboxFolder> {
    return this.client.request<MailboxFolder>({
      method: "PATCH",
      path: `/mailboxes/${encodeURIComponent(id)}/folders/${encodeURIComponent(folderId)}`,
      body: params,
      methodOptions: options,
    });
  }

  deleteFolder(id: string, folderId: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/mailboxes/${encodeURIComponent(id)}/folders/${encodeURIComponent(folderId)}`,
      methodOptions: options,
    });
  }

  listIdentities(id: string, options?: MethodOptions): Promise<MailboxIdentities> {
    return this.client.request<MailboxIdentities>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/identities`,
      methodOptions: options,
    });
  }

  listInboxMessages(
    id: string,
    params?: ListInboxMessagesParams,
    options?: MethodOptions,
  ): Promise<InboxMessages> {
    return this.client.request<InboxMessages>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/messages`,
      query: {
        folder_id: params?.folder_id,
        folder_role: params?.folder_role,
        search_text: params?.search_text,
        from: params?.from,
        to: params?.to,
        subject: params?.subject,
        has_attachment: params?.has_attachment,
        cursor: params?.cursor,
        after: params?.after,
        before: params?.before,
        limit: params?.limit,
        has_keyword: params?.has_keyword,
        not_keyword: params?.not_keyword,
      },
      methodOptions: options,
    });
  }

  getInboxMessage(id: string, messageId: string, options?: MethodOptions) {
    return this.client.request<import("../types/mailbox.js").InboxFullMessage>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/messages/${encodeURIComponent(messageId)}`,
      methodOptions: options,
    });
  }

  releaseInboxMessageSecurity(
    id: string,
    messageId: string,
    params: ReleaseInboxMessageSecurityParams,
    options?: MethodOptions,
  ): Promise<InboxMessageSecurityReview> {
    return this.client.request<InboxMessageSecurityReview>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/messages/${encodeURIComponent(messageId)}/security-review`,
      body: params,
      methodOptions: options,
    });
  }

  listInboxThreads(
    id: string,
    params?: ListInboxThreadsParams,
    options?: MethodOptions,
  ): Promise<InboxThreads> {
    return this.client.request<InboxThreads>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads`,
      query: {
        attention_state: params?.attention_state,
        sort_by: params?.sort_by,
        order: params?.order,
        after: params?.after,
        before: params?.before,
        cursor: params?.cursor,
        limit: params?.limit,
      },
      methodOptions: options,
    });
  }

  getInboxThread(id: string, threadId: string, options?: MethodOptions): Promise<InboxThread> {
    return this.client.request<InboxThread>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads/${encodeURIComponent(threadId)}`,
      methodOptions: options,
    });
  }

  updateInboxThreadAttention(
    id: string,
    threadId: string,
    params: UpdateInboxThreadAttentionParams,
    options?: MethodOptions,
  ): Promise<InboxThreadAttentionResult> {
    return this.client.request<InboxThreadAttentionResult>({
      method: "PATCH",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads/${encodeURIComponent(threadId)}`,
      body: params,
      methodOptions: options,
    });
  }

  /** Saves a new message to the mailbox's Drafts folder. It is never sent by this call. */
  createInboxDraft(
    id: string,
    params: CreateInboxDraftParams,
    options?: MethodOptions,
  ): Promise<InboxDraft> {
    return this.client.request<InboxDraft>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/drafts`,
      body: params,
      methodOptions: options,
    });
  }

  createInboxReplyDraft(
    id: string,
    threadId: string,
    params: CreateInboxReplyDraftParams,
    options?: MethodOptions,
  ): Promise<InboxReplyDraftWrite> {
    return this.client.request<InboxReplyDraftWrite>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads/${encodeURIComponent(threadId)}/drafts`,
      body: params,
      methodOptions: options,
    });
  }

  /** Lists the conversation's reply drafts in every status, newest first, at most 100. */
  listInboxReplyDrafts(
    id: string,
    threadId: string,
    options?: MethodOptions,
  ): Promise<InboxReplyDraftList> {
    return this.client.request<InboxReplyDraftList>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads/${encodeURIComponent(threadId)}/drafts`,
      methodOptions: options,
    });
  }

  getInboxReplyDraft(
    id: string,
    threadId: string,
    draftId: string,
    options?: MethodOptions,
  ): Promise<InboxReplyDraft> {
    return this.client.request<InboxReplyDraft>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads/${encodeURIComponent(threadId)}/drafts/${encodeURIComponent(draftId)}`,
      methodOptions: options,
    });
  }

  /** Replaces the draft body. Recipients, subject and reply headers stay derived from the source message. */
  updateInboxReplyDraft(
    id: string,
    threadId: string,
    draftId: string,
    params: UpdateInboxReplyDraftParams,
    options?: MethodOptions,
  ): Promise<InboxReplyDraftWrite> {
    return this.client.request<InboxReplyDraftWrite>({
      method: "PATCH",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads/${encodeURIComponent(threadId)}/drafts/${encodeURIComponent(draftId)}`,
      body: params,
      methodOptions: options,
    });
  }

  deleteInboxReplyDraft(
    id: string,
    threadId: string,
    draftId: string,
    options?: MethodOptions,
  ): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads/${encodeURIComponent(threadId)}/drafts/${encodeURIComponent(draftId)}`,
      methodOptions: options,
    });
  }

  sendInboxReplyDraft(
    id: string,
    threadId: string,
    draftId: string,
    options?: MethodOptions & { readonly expectedContentSha256?: string | undefined },
  ): Promise<InboxReplyDraftSend> {
    return this.client.request<InboxReplyDraftSend>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads/${encodeURIComponent(threadId)}/drafts/${encodeURIComponent(draftId)}/send`,
      body:
        options?.expectedContentSha256 === undefined
          ? undefined
          : { expected_content_sha256: options.expectedContentSha256 },
      methodOptions: options,
    });
  }

  replyToInboxMessage(
    id: string,
    messageId: string,
    params: ReplyToMessageParams,
    options?: MethodOptions,
  ): Promise<Message> {
    return this.client.request<Message>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/messages/${encodeURIComponent(messageId)}/reply`,
      body: params,
      methodOptions: options,
    });
  }

  replyToInboxThread(
    id: string,
    threadId: string,
    params: ReplyToMessageParams,
    options?: MethodOptions,
  ): Promise<Message> {
    return this.client.request<Message>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/threads/${encodeURIComponent(threadId)}/reply`,
      body: params,
      methodOptions: options,
    });
  }

  updateInboxMessage(
    id: string,
    messageId: string,
    params: UpdateInboxMessageParams,
    options?: MethodOptions,
  ): Promise<InboxMessageAction> {
    return this.client.request<InboxMessageAction>({
      method: "PATCH",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/messages/${encodeURIComponent(messageId)}`,
      body: params,
      methodOptions: options,
    });
  }

  moveInboxMessage(
    id: string,
    messageId: string,
    params: MoveInboxMessageParams,
    options?: MethodOptions,
  ): Promise<InboxMessageAction> {
    return this.client.request<InboxMessageAction>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/messages/${encodeURIComponent(messageId)}/move`,
      body: params,
      methodOptions: options,
    });
  }

  deleteInboxMessage(id: string, messageId: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/messages/${encodeURIComponent(messageId)}`,
      methodOptions: options,
    });
  }

  downloadInboxAttachment(
    id: string,
    params: DownloadInboxAttachmentParams,
    options?: MethodOptions,
  ): Promise<Uint8Array> {
    return this.client.requestBytes({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/inbox/attachments`,
      query: {
        blob_id: params.blob_id,
        message_id: params.message_id,
        name: params.name,
      },
      methodOptions: options,
    });
  }

  resetPassword(
    id: string,
    params: ResetMailboxPasswordParams,
    options?: MethodOptions,
  ): Promise<Mailbox> {
    return this.client.request<Mailbox>({
      method: "PATCH",
      path: `/mailboxes/${encodeURIComponent(id)}/password`,
      body: params,
      methodOptions: options,
    });
  }

  listAppPasswords(id: string, options?: MethodOptions): Promise<MailboxAppPasswordList> {
    return this.client.request<MailboxAppPasswordList>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/app-passwords`,
      methodOptions: options,
    });
  }

  createAppPassword(
    id: string,
    params: CreateMailboxAppPasswordParams,
    options?: OneTimeSecretMethodOptions,
  ): Promise<CreatedMailboxAppPassword> {
    return this.client.request<CreatedMailboxAppPassword>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/app-passwords`,
      body: params,
      methodOptions: options,
    });
  }

  revokeAppPassword(id: string, appPasswordId: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/mailboxes/${encodeURIComponent(id)}/app-passwords/${encodeURIComponent(appPasswordId)}`,
      methodOptions: options,
    });
  }

  getRules(id: string, options?: MethodOptions): Promise<MailboxRules> {
    return this.client.request<MailboxRules>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/rules`,
      methodOptions: options,
    });
  }

  updateRules(
    id: string,
    params: UpdateMailboxRulesParams,
    options?: MethodOptions,
  ): Promise<MailboxRules> {
    return this.client.request<MailboxRules>({
      method: "PUT",
      path: `/mailboxes/${encodeURIComponent(id)}/rules`,
      body: params,
      methodOptions: options,
    });
  }

  listForwarding(id: string, options?: MethodOptions): Promise<MailboxForwardingList> {
    return this.client.request<MailboxForwardingList>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/forwarding`,
      methodOptions: options,
    });
  }

  createForwarding(
    id: string,
    params: CreateMailboxForwardingParams,
    options?: MethodOptions,
  ): Promise<MailboxForwarding> {
    return this.client.request<MailboxForwarding>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/forwarding`,
      body: params,
      methodOptions: options,
    });
  }

  deleteForwarding(id: string, forwardingId: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/mailboxes/${encodeURIComponent(id)}/forwarding/${encodeURIComponent(forwardingId)}`,
      methodOptions: options,
    });
  }

  updateAutoReply(
    id: string,
    params: UpdateAutoReplyParams,
    options?: MethodOptions,
  ): Promise<Mailbox> {
    return this.client.request<Mailbox>({
      method: "PATCH",
      path: `/mailboxes/${encodeURIComponent(id)}/auto-reply`,
      body: params,
      methodOptions: options,
    });
  }

  getDeliveryRouting(id: string, options?: MethodOptions): Promise<MailboxDeliveryRouting> {
    return this.client.request<MailboxDeliveryRouting>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/delivery-routing`,
      methodOptions: options,
    });
  }

  updateDeliveryRouting(
    id: string,
    params: UpdateMailboxDeliveryRoutingParams,
    options?: MethodOptions,
  ): Promise<MailboxDeliveryRouting> {
    return this.client.request<MailboxDeliveryRouting>({
      method: "PATCH",
      path: `/mailboxes/${encodeURIComponent(id)}/delivery-routing`,
      body: params,
      methodOptions: options,
    });
  }

  createImport(
    id: string,
    params: CreateMailboxImportParams,
    options?: MethodOptions,
  ): Promise<MailboxImport> {
    return this.client.request<MailboxImport>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/imports`,
      body: params,
      methodOptions: options,
    });
  }

  listImports(id: string, options?: MethodOptions): Promise<MailboxImports> {
    return this.client.request<MailboxImports>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/imports`,
      methodOptions: options,
    });
  }

  getImport(id: string, importId: string, options?: MethodOptions): Promise<MailboxImport> {
    return this.client.request<MailboxImport>({
      method: "GET",
      path: `/mailboxes/${encodeURIComponent(id)}/imports/${encodeURIComponent(importId)}`,
      methodOptions: options,
    });
  }

  cancelImport(id: string, importId: string, options?: MethodOptions): Promise<MailboxImport> {
    return this.client.request<MailboxImport>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/imports/${encodeURIComponent(importId)}/cancel`,
      methodOptions: options,
    });
  }

  resumeImport(id: string, importId: string, options?: MethodOptions): Promise<MailboxImport> {
    return this.client.request<MailboxImport>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/imports/${encodeURIComponent(importId)}/resume`,
      methodOptions: options,
    });
  }

  restoreImport(
    id: string,
    importId: string,
    params: RestoreMailboxImportParams,
    options?: MethodOptions,
  ): Promise<MailboxImport> {
    return this.client.request<MailboxImport>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/imports/${encodeURIComponent(importId)}/restore`,
      body: params,
      methodOptions: options,
    });
  }

  undoImport(id: string, importId: string, options?: MethodOptions): Promise<MailboxImport> {
    return this.client.request<MailboxImport>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/imports/${encodeURIComponent(importId)}/undo`,
      methodOptions: options,
    });
  }

  createImportUpload(
    id: string,
    params: CreateImportUploadParams,
    options?: MethodOptions,
  ): Promise<ImportUpload> {
    return this.client.request<ImportUpload>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/imports/files`,
      body: params,
      methodOptions: options,
    });
  }

  completeImportUpload(
    id: string,
    fileId: string,
    params: CompleteImportUploadParams,
    options?: MethodOptions,
  ): Promise<void> {
    return this.client.request<void>({
      method: "POST",
      path: `/mailboxes/${encodeURIComponent(id)}/imports/files/${encodeURIComponent(fileId)}/complete`,
      body: params,
      methodOptions: options,
    });
  }

  abortImportUpload(id: string, fileId: string, options?: MethodOptions): Promise<void> {
    return this.client.request<void>({
      method: "DELETE",
      path: `/mailboxes/${encodeURIComponent(id)}/imports/files/${encodeURIComponent(fileId)}`,
      methodOptions: options,
    });
  }
}
