// Transport boundary only. The shared Core controller owns recovery policy.
function createAvSyncV2Bridge({ dispatch, correct, clock }) {
    let session = null;
    let observed = null;
    let applied = null;
    let acknowledged = null;
    const now = () => Math.floor(clock());
    const safe = (value) => Number.isSafeInteger(value) && value >= 0;
    const scope = (model) => {
        const state = model?.avSyncV2;
        if (state?.protocolVersion !== 2 || !safe(state.sessionId) || state.sessionId === 0 || !model.selected) return null;
        if (session !== state.sessionId) {
            session = state.sessionId;
            observed = null;
            applied = null;
            acknowledged = null;
        }
        return state;
    };
    const send = (action, args) => dispatch({ action: 'Player', args: { action, args } }, 'player');
    const playing = (state, seeking) => state?.loaded === true && state.paused === false && state.buffering === false && !seeking;
    const sampleValid = (sample, state, time) => sample && safe(time) &&
        ['sessionId', 'epoch', 'sampleId', 'capturedAtMs'].every((key) => safe(sample[key])) &&
        sample.sessionId === state.sessionId && sample.sampleId > 0 &&
        sample.capturedAtMs <= time && time - sample.capturedAtMs <= 1500 &&
        Number.isSafeInteger(sample.offsetMs) && Math.abs(sample.offsetMs) <= 60000 &&
        ['active', 'videoStable', 'canSoftCorrect', 'canHardCorrect'].every((key) => typeof sample[key] === 'boolean');
    return {
        observe(sample, model, videoState, seeking) {
            const state = scope(model);
            const time = now();
            if (!state || !videoState.manifest?.props?.includes('avSyncV2') || !sampleValid(sample, state, time)) return;
            const key = `${sample.sessionId}/${sample.epoch}/${sample.sampleId}`;
            if (observed === key) return;
            observed = key;
            send('AvSyncV2Observed', {
                observation: {
                    sessionId: sample.sessionId, epoch: sample.epoch, sampleId: sample.sampleId,
                    capturedAtMs: sample.capturedAtMs, offsetMs: sample.offsetMs,
                    active: sample.active && playing(videoState, seeking), videoStable: sample.videoStable,
                    canSoftCorrect: sample.canSoftCorrect, canHardCorrect: sample.canHardCorrect,
                },
                nowMs: time,
            });
        },
        recover(request, model, videoState, seeking) {
            const state = scope(model);
            const time = now();
            const sample = videoState.avSyncV2;
            if (!state || !playing(videoState, seeking) || model.playbackHealth?.recovery ||
                !videoState.manifest?.commands?.includes('correctAvSyncV2') ||
                !sampleValid(sample, state, time) || !request ||
                !['sessionId', 'epoch', 'sampleId', 'generation', 'issuedAtMs', 'expiresAtMs'].every((key) => safe(request[key])) ||
                request.sessionId !== state.sessionId || request.epoch !== sample.epoch || request.sampleId !== sample.sampleId ||
                request.generation === 0 || request.issuedAtMs < sample.capturedAtMs || request.issuedAtMs > time ||
                request.expiresAtMs < time || request.expiresAtMs < request.issuedAtMs || request.expiresAtMs - request.issuedAtMs > 1500 ||
                !sample.active || !sample.videoStable ||
                (request.correction === 'nativeClock' ? !sample.canSoftCorrect : request.correction === 'reseek' ? !sample.canHardCorrect : true)) return;
            const key = `${request.sessionId}/${request.epoch}/${request.generation}`;
            if (applied === key) return;
            applied = key;
            // Consumption happens before dispatch to prevent reentrant replay.
            correct({ sessionId: request.sessionId, epoch: request.epoch, sampleId: request.sampleId,
                generation: request.generation, issuedAtMs: request.issuedAtMs, expiresAtMs: request.expiresAtMs, correction: request.correction });
        },
        acknowledge(ack, model) {
            const state = scope(model);
            const request = state?.pending;
            const time = now();
            if (!request || !ack || !safe(time) || typeof ack.accepted !== 'boolean' ||
                ack.sessionId !== state.sessionId || ack.epoch !== request.epoch || ack.generation !== request.generation) return;
            const key = `${ack.sessionId}/${ack.epoch}/${ack.generation}`;
            if (acknowledged === key) return;
            acknowledged = key;
            send('AvSyncV2Acknowledged', { acknowledgement: { sessionId: ack.sessionId, epoch: ack.epoch, generation: ack.generation, accepted: ack.accepted }, nowMs: time });
        },
        tick(model) {
            const state = scope(model);
            const time = now();
            if (state && safe(time)) send('AvSyncV2Tick', { sessionId: state.sessionId, nowMs: time });
        },
    };
}
module.exports = createAvSyncV2Bridge;
