import * as React from 'react';
import { compose, pure, setDisplayName } from 'recompose';
import useStyles from './HomeButton.styles';
import { useNavigate } from 'react-router';
import { MANAGE } from '../../constants/paths';

interface IPublic {
  extraPath?: string;
}

interface IProps extends IPublic {}

const HomeButton = (props: IProps) => {
  const classes = useStyles();
  const navigate = useNavigate();
  return (
    <div className={classes.navigationBar}>
      <div
        onClick={() =>
          navigate(`${MANAGE}${props.extraPath ? `/${props.extraPath}` : ''}`)
        }
        className={classes.homeButton}>
        <div className={classes.homeArrow}> </div>
        <div className={classes.homeSquare}> </div>
        <div className={classes.homeText}>{'Home'}</div>
      </div>
      <div className={classes.navigationBarRightSide} />
    </div>
  );
};

const ComposedHomeButton: React.ComponentClass<IProps> = compose<
  IProps,
  IPublic
>(
  pure,
  setDisplayName('HomeButton'),
)(HomeButton);

export default ComposedHomeButton;
