// Copyright (C) 2017-2023 Smart code 203358507

const React = require('react');
const PropTypes = require('prop-types');
const classnames = require('classnames');
const { default: Icon } = require('@stremio/stremio-icons/react');
const { Button } = require('stremio/components');
const { useTranslation } = require('react-i18next');
const styles = require('./styles');

const SkipIntroPopup = ({ className, kind, onDismiss, onSkipRequested }) => {
    const { t } = useTranslation();
    const rootRef = React.useRef(null);
    const skipButtonRef = React.useRef(null);
    const label = kind === 'recap' ? t('PLAYER_SKIP_RECAP', { defaultValue: 'Skip Recap' }) :
        kind === 'outro' ? t('PLAYER_SKIP_CREDITS', { defaultValue: 'Skip Credits' }) :
            t('PLAYER_SKIP_INTRO', { defaultValue: 'Skip Intro' });

    React.useLayoutEffect(() => {
        const root = rootRef.current;
        const previous = document.activeElement;
        if (previous === document.body || previous === document.documentElement) {
            skipButtonRef.current?.focus({ preventScroll: true });
        }
        return () => {
            if (root?.contains(document.activeElement) && previous instanceof HTMLElement && previous.isConnected) {
                previous.focus({ preventScroll: true });
            }
        };
    }, []);

    const onKeyDown = React.useCallback((event) => {
        if (['Enter', ' ', 'Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.buttonClickPrevented = true;
            if (event.repeat) return;
            if (event.key === 'Escape') {
                onDismiss?.();
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                const buttons = Array.from(rootRef.current?.querySelectorAll('[role="button"]') || []);
                const index = buttons.indexOf(document.activeElement);
                buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
            } else {
                event.currentTarget.click();
            }
        }
    }, [onDismiss]);

    return (
        <div ref={rootRef} role={'group'} aria-label={label}
            className={classnames(className, styles['skip-intro-popup-container'])}>
            <div className={styles['title']}>{label}</div>
            <div className={styles['buttons-container']}>
                <Button role={'button'} className={classnames(styles['button-container'], styles['dismiss'])}
                    onKeyDown={onKeyDown} onClick={onDismiss}>
                    <Icon className={styles['icon']} name={'close'} />
                    <div className={styles['label']}>{t('PLAYER_NEXT_VIDEO_BUTTON_DISMISS')}</div>
                </Button>
                <Button ref={skipButtonRef} role={'button'}
                    className={classnames(styles['button-container'], styles['skip-button'])}
                    onKeyDown={onKeyDown} onClick={onSkipRequested}>
                    <Icon className={styles['icon']} name={'next'} />
                    <div className={styles['label']}>{label}</div>
                </Button>
            </div>
        </div>
    );
};

SkipIntroPopup.propTypes = {
    className: PropTypes.string,
    kind: PropTypes.oneOf(['intro', 'recap', 'outro']).isRequired,
    onDismiss: PropTypes.func,
    onSkipRequested: PropTypes.func,
};

module.exports = SkipIntroPopup;
