import * as React from 'react';
import * as Radium from 'radium';
import { Component, compose, pure, setDisplayName } from 'recompose';
import * as renderIf from 'render-if';

interface IProps {
  schema?: JSONSchema4;
}

import Form from 'react-jsonschema-form';
import { connect } from 'react-redux';
import { schemaSelector } from '../../../../selectors/SystemSelectors';
import { JSONSchema4 } from 'json-schema';

const schema = {
  title: 'Todo',
  type: 'object',
  required: ['title'],
  properties: {
    title: { type: 'string', title: 'Title', default: 'A new task' },
    done: { type: 'boolean', title: 'Done?', default: false },
  },
};

const JsonSchemaForm: React.StatelessComponent<IProps> = (props: IProps) => {
  return (
    <div>
      {renderIf(props.schema)(() => (
        <Form
          schema={schema}
          onChange={console.log('changed')}
          onSubmit={console.log('submitted')}
          onError={console.log('errors')}
        />
      ))}
    </div>
  );
};

const ComposedJsonSchemaForm: Component<IProps> = compose<IProps>(
  pure,
  Radium,
  setDisplayName('JsonSchemaForm'),
  connect(schemaSelector),
)(JsonSchemaForm);

export default ComposedJsonSchemaForm;
