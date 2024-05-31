import { makeStyles } from '@material-ui/core/styles';
import {
  BLACK_COLOR,
  BLUE_COLOR,
  GREY_COLOR,
  LIGHT_BLUE_COLOR3,
  WHITE_COLOR,
} from '../../../styles/DefaultStylingProperties';

const useStyles = makeStyles({
  chatContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '30vw',
    top: 0,
    right: 0,
    height: '100vh',
    position: 'fixed',
    border: `1px solid ${GREY_COLOR}`,
    overflow: 'auto',
    backgroundColor: BLACK_COLOR,
    paddingTop: '50px',
    transition: 'right 0.5s ease',
  },
  hiddenChat: {
    right: '-30vw',
    transition: 'right 0.5s ease',
  },
  closeChat: {
    position: 'absolute',
    top: 15,
    right: 15,
    cursor: 'pointer',

    '&:hover svg': {
      color: BLUE_COLOR,
    },

    '& svg': {
      color: WHITE_COLOR,
    },
  },
  loader: {
    position: 'absolute',
    margin: 'auto',
    top: 'calc(50vh - 20px)',
    left: 'calc(50% - 20px)',
    right: '50%',
  },
  loadingIndicator: {
    width: 40,
    height: 40,
  },
  error: {
    display: 'flex',
    alignSelf: 'center',
    color: GREY_COLOR,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: GREY_COLOR,
    fontSize: '1rem',
  },
  chat: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    padding: '10px',
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  quickRepliesButton: {
    marginRight: '10px',
    borderRadius: '15px!important',
    backgroundColor: `${BLUE_COLOR}!important`,
    color: WHITE_COLOR,
    transition: 'none',
    fontSize: '1rem',
    padding: '4px 10px',
    marginTop: '2px',
    marginLeft: '10px',

    '&:hover': {
      backgroundColor: 'transparent!important',
      border: `2px solid ${BLUE_COLOR}!important`,
      color: `${BLUE_COLOR}!important`,
      padding: '2px 8px!important',
      transition: 'none',
    },
  },
  outputText: {
    color: WHITE_COLOR,
    padding: '5px 10px',
    margin: 0,
    backgroundColor: LIGHT_BLUE_COLOR3,
    borderRadius: '15px',
    overflow: 'hidden',
    marginBottom: '5px',
    float: 'left',
  },
});

export default useStyles;
