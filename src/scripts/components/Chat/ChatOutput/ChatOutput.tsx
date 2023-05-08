import * as React from 'react';
import useStyles from './ChatOutput.styles';
import clsx from 'clsx';
import useScrollIntoView from '../../utils/useScrollIntoView';
import parse from 'html-react-parser';




interface IChatOutput {
  output: { text: string };
  input?: boolean;
}

const ChatOutput = ({ output, input }: IChatOutput) => {
  const classes = useStyles();
  const chatOutputRef = React.useRef<HTMLDivElement>(null);

  const outputText = typeof output === 'string' ? output : output.text;

  if (!outputText) {
    return null;
  }

  useScrollIntoView(chatOutputRef, output);

  return (
    <div
      className={clsx(classes.chatOutput, input ? classes.chatInput : null)}
      ref={chatOutputRef}>
      <p className={clsx(classes.outputText, input ? classes.inputText : null)}>
        {parse(outputText)}
      </p>
    </div>
  );
};

export default ChatOutput;
