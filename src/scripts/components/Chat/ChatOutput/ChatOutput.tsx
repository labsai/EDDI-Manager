import clsx from 'clsx';
import * as React from 'react';
// import Markdown from 'react-markdown';
// import rehypeHighlight from 'rehype-highlight';
// import rehypeKatex from 'rehype-katex';
// import rehypeRaw from 'rehype-raw';
// import remarkGfm from 'remark-gfm';
// import remarkMath from 'remark-math';
import useScrollIntoView from '../../utils/useScrollIntoView';
import parse from 'html-react-parser';

import useStyles from './ChatOutput.styles';
// import 'katex/dist/katex.min.css';

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
        {/* <Markdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeKatex]}
          children={outputText}
        /> */}
      </p>
    </div>
  );
};

export default ChatOutput;
