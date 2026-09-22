const React = require('react');
const createAvSyncV2Bridge = require('./avSyncV2Bridge');

function useAvSyncV2(core, player, video, seeking) {
    const transport = core.transport;
    const correct = video.correctAvSyncV2;
    const bridge = React.useMemo(() => createAvSyncV2Bridge({
        dispatch: (action, field) => transport.dispatch(action, field),
        correct,
        clock: () => typeof performance !== 'undefined' ? performance.now() : NaN,
    }), [transport, correct]);
    const playerRef = React.useRef(player);
    playerRef.current = player;
    const capable = player.avSyncV2?.protocolVersion === 2 && video.state.manifest?.props?.includes('avSyncV2');
    const sessionId = player.avSyncV2?.sessionId;

    React.useEffect(() => {
        bridge.observe(video.state.avSyncV2, player, video.state, seeking);
    }, [bridge, video.state.avSyncV2, video.state.loaded, video.state.paused, video.state.buffering, video.state.manifest, player, seeking]);

    React.useEffect(() => {
        bridge.acknowledge(video.state.avSyncV2Ack, player);
    }, [bridge, video.state.avSyncV2Ack, player]);

    React.useEffect(() => {
        bridge.recover(player.avSyncV2?.pending, player, video.state, seeking);
    }, [bridge, player, video.state.avSyncV2, video.state.loaded, video.state.paused, video.state.buffering, video.state.manifest, seeking]);

    React.useEffect(() => {
        if (!capable || !sessionId) return;
        // Expiry only. This heartbeat never manufactures a clock observation.
        const timer = setInterval(() => bridge.tick(playerRef.current), 500);
        return () => clearInterval(timer);
    }, [bridge, capable, sessionId]);
}
module.exports = useAvSyncV2;
