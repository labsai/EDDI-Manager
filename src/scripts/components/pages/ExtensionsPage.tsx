import * as React from 'react';
import { compose, pure, setDisplayName } from 'recompose';
import useStyles from '../App.style';
import PluginList from '../Plugins/PluginList';
import TopBarComponent from '../TopBar/TopBarComponent';
import {
  BEHAVIOR,
  GITCALLS,
  HTTPCALLS,
  LANGCHAIN,
  OUTPUT,
  PROPERTYSETTER,
  REGULAR_DICTIONARY,
} from '../utils/EddiTypes';
import Parser from '../utils/Parser';
import { pageEnum } from './pageEnum';
import { useLocation } from 'react-router';

const eddiLogo = require('../../../public/images/eddi-logo-white.svg');

const ExtensionsPage = () => {
  const location = useLocation();
  const [filterText, setFilterText] = React.useState('');

  const classes = useStyles();

  const filter = (text: string) => {
    setFilterText(text);
  };

  const getTypeFromQueryString = () => {
    const type = Parser.getQueryStrings(location.search).type;
    return type;
  };

  const getEddiType = (type: string) => {
    switch (type) {
      case 'dictionary':
        return REGULAR_DICTIONARY;
      case 'behavior':
        return BEHAVIOR;
      case 'output':
        return OUTPUT;
      case 'httpCalls':
        return HTTPCALLS;
      case 'langchain':
        return LANGCHAIN;
      case 'gitCalls':
        return GITCALLS;
      case 'property':
        return PROPERTYSETTER;
      default:
        return;
    }
  };

  const type = getTypeFromQueryString();
  const eddiType = getEddiType(type);
  return (
    <div>
      <img src={eddiLogo} className={classes.eddiLogo} />
      <div>
        <TopBarComponent
          page={pageEnum[type]}
          filter={filter}
          type={eddiType}
        />
        <PluginList filterText={filterText} pluginType={eddiType} />
      </div>
    </div>
  );
};

const ComposedExtensionsPage: React.ComponentClass<{}> = compose<{}, {}>(
  pure,
  setDisplayName('ExtensionsPage'),
)(ExtensionsPage);

export default ComposedExtensionsPage;
