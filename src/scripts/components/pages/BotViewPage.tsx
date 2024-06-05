import * as React from 'react';
import BotInfo from '../BotDetailView/BotInfo';
import Parser from '../utils/Parser';
import { useLocation, useParams } from 'react-router';

function getVersion(search: string) {
  const queryStrings = Parser.getQueryStrings(search);
  return queryStrings.version;
}

const BotViewPage = () => {
  const params = useParams();
  const { search } = useLocation();
  return (
    <div>
      <BotInfo botId={params.id} botVersion={getVersion(search)} />
    </div>
  );
};

export default BotViewPage;
