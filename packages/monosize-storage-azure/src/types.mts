/**
 * @see https://github.com/Azure/azure-sdk-for-js/blob/main/sdk/identity/identity/samples/AzureIdentityExamples.md#authenticating-azure-hosted-applications
 */
export type AzureAuthenticationType = 'AzureNamedKeyCredential' | 'AzurePipelinesCredential';

export type AzureStorageConfig = {
  endpoint: string;
  /**
   * @default 'AzureNamedKeyCredential' auth type
   */
  authType?: AzureAuthenticationType;
};
