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
    const skipButtonRef = React.useRef(null);
    const [animationEnded, setAnimationEnded] = React.useState(false);

    const label = React.useMemo(() => {
        switch (kind) {
            case 'recap':
                return t('PLAYER_SKIP_RECAP', { defaultValue: 'Skip Recap' });
            case 'outro':
                return t('PLAYER_SKIP_OUTRO', { defaultValue: 'Skip Credits' });
            case 'intro':
            default:
                return t('PLAYER_SKIP_INTRO', { defaultValue: 'Skip Intro' });
        }
    }, [kind, t]);

    React.useLayoutEffect(() => {
        if (animationEnded && skipButtonRef.current !== null) {
            skipButtonRef.current.focus();
        }
    }, [animationEnded]);

    const onDismissButtonClick = React.useCallback(() => {
        if (typeof onDismiss === 'function') {
            onDismiss();
        }
    }, [onDismiss]);

    const onSkipButtonClick = React.useCallback(() => {
        if (typeof onSkipRequested === 'function') {
            onSkipRequested();
        }
    }, [onSkipRequested]);

    return (
        <div
            className={classnames(className, styles['skip-intro-popup-container'])}
            onAnimationEnd={() => setAnimationEnded(true)}
        >
            <div className={styles['title']}>{label}</div>
            <div className={styles['buttons-container']}>
                <Button
                    className={classnames(styles['button-container'], styles['dismiss'])}
                    onClick={onDismissButtonClick}
                >
                    <Icon className={styles['icon']} name={'close'} />
                    <div className={styles['label']}>{t('PLAYER_NEXT_VIDEO_BUTTON_DISMISS')}</div>
                </Button>
                <Button
                    ref={skipButtonRef}
                    className={classnames(styles['button-container'], styles['skip-button'])}
                    onClick={onSkipButtonClick}
                >
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
