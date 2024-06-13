import * as React from 'react';
import { useSelector } from 'react-redux';
import { getChatAnimation } from '../../../selectors/ChatSelectors';
import useStyles from '../Chat.styles';

const loadingIndicator = require('../../../../public/images/loading-indicator.svg');

const Delayed = ({
  wait,
  children,
  showTyping = false,
  ignoreAnimation = false,
}: {
  wait: number;
  children: any;
  showTyping?: boolean;
  ignoreAnimation?: boolean;
}) => {
  const classes = useStyles();
  const [hidden, setHidden] = React.useState(true);
  const animation = useSelector(getChatAnimation);

  const hasAnimation = ignoreAnimation ? true : animation;

  const typingComponent = showTyping ? (
    <img src={loadingIndicator} className={classes.loadingIndicator} />
  ) : null;

  React.useEffect(() => {
    const timer = setTimeout(
      () => {
        setHidden(false);
      },
      hasAnimation ? wait * 2 : 0,
    );

    return () => clearTimeout(timer);
  }, []);

  return hidden ? typingComponent : children;
};

export default Delayed;
