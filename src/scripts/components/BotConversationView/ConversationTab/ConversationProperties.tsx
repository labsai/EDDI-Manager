import * as React from 'react';
import { compose, pure, setDisplayName } from 'recompose';
import { IConversationProperties } from '../../utils/AxiosFunctions';
import {
  DARK_BLUE_BORDER,
  WHITE_COLOR,
  MEDIUM_FONT3,
  SMALL_FONT2,
} from '../../../../styles/DefaultStylingProperties';
import TruncateTextComponent from '../../Assets/TruncateTextComponent';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({
  title: {
    fontSize: MEDIUM_FONT3,
    color: WHITE_COLOR,
    textAlign: 'center',
    margin: '20px 0px 20px 0px',
    borderBottom: DARK_BLUE_BORDER,
  },
  content: {
    marginBottom: '50px',
  },
  propertyTitle: {
    display: 'flex',
    color: WHITE_COLOR,
    fontSize: SMALL_FONT2,
  },
  property: {
    width: '200px',
  },
  propertyValues: {
    display: 'flex',
  },
  propertyName: {
    minWidth: '200px',
    color: WHITE_COLOR,
    paddingBottom: '2px',
  },
  propertyValue: {
    overflowWrap: 'anywhere',
  },
});

interface IProps {
  conversationProperties: IConversationProperties;
}

const ConversationProperties = ({ conversationProperties }: IProps) => {
  const classes = useStyles();
  const keys = Object.keys(conversationProperties);
  return (
    <div className={classes.content}>
      <div className={classes.title}>
        {`Conversation Properties {${keys.length}}`}
      </div>
      <div className={classes.propertyTitle}>
        <div className={classes.property}>{'Name'}</div>
        <div className={classes.property}>{'Scope'}</div>
        <div className={classes.property}>{'Value'}</div>
      </div>
      <div>
        {keys.map((property, i) => (
          <div className={classes.propertyValues} key={i}>
            <div className={classes.propertyName}>
              {conversationProperties[property].name}
            </div>
            <div className={classes.propertyName}>
              {conversationProperties[property].scope}
            </div>
            <TruncateTextComponent
              classes={{ text: classes.propertyValue }}
              text={
                typeof conversationProperties["valueString"].value !== null
                  ? JSON.stringify(
                    conversationProperties["valueString"].value,
                    null,
                    '\t',
                  ) :
                  typeof conversationProperties["valueObject"].value !== null
                    ? JSON.stringify(
                      conversationProperties["valueObject"].value,
                      null,
                      '\t',
                    ) :
                    typeof conversationProperties["valueList"].value !== null
                      ? JSON.stringify(
                        conversationProperties["valueList"].value,
                        null,
                        '\t',
                      ) :
                      typeof conversationProperties["valueInt"].value !== null
                        ? JSON.stringify(
                          conversationProperties["valueInt"].value,
                          null,
                          '\t',
                        ) :
                        typeof conversationProperties["valueFloat"].value !== null
                          ? JSON.stringify(
                            conversationProperties["valueFloat"].value,
                            null,
                            '\t',
                          ) :
                          typeof conversationProperties["valueBoolean"].value !== null
                            ? JSON.stringify(
                              conversationProperties["valueBoolean"].value,
                              null,
                              '\t',
                            ) :
                            "No value provided!"
              }
              length={40}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const ComposedConversationProperties: React.ComponentClass<IProps> = compose<
  IProps,
  IProps
>(
  pure,
  setDisplayName('ConversationProperties'),
)(ConversationProperties);

export default ComposedConversationProperties;
