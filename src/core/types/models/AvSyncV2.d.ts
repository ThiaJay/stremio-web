type AvSyncV2Request = {
    sessionId: number;
    epoch: number;
    generation: number;
    sampleId: number;
    issuedAtMs: number;
    expiresAtMs: number;
    correction: 'nativeClock' | 'reseek';
};

type AvSyncV2Controller = {
    protocolVersion: 2;
    sessionId: number;
    status: 'unknown' | 'monitoring' | 'stable' | 'awaitingAck' | 'recovering' | 'unsupported' | 'exhausted';
    offsetMs: number | null;
    pending: AvSyncV2Request | null;
};
