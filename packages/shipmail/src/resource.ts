import type { ShipmailClient } from "./client.js";

export abstract class ApiResource {
  protected readonly client: ShipmailClient;

  constructor(client: ShipmailClient) {
    this.client = client;
  }
}
