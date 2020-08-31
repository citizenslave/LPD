export class SyncStatus {
    status: string;
    syncTime: number;
    lastSync: string;
    checkInterval: ReturnType<typeof setTimeout>;
}