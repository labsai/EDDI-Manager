import * as React from 'react';
import BotConversationView from '../BotConversationView/BotConversationView';
import Parser from '../utils/Parser';
import { useParams } from 'react-router';

const BotConversationViewPage = () => {
  const { id } = useParams();
  return (
    <div>
      <BotConversationView conversationId={id} />
    </div>
  );
};

export default BotConversationViewPage;
