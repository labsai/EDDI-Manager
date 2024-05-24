export interface ISnippet {
  scope: string;
  name: string;
  tabTrigger: string;
  content: string;
}
export const regularDictionarySnippets: ISnippet[] = [
  {
    scope: 'json',
    name: 'phrases',
    tabTrigger: 'phrases',
    content: `"phrases": [\${1:}]`,
  },
  {
    scope: 'json',
    name: 'phrase',
    tabTrigger: 'phrase',
    content: `{
  "phrase": "\${1:phrase}",
  "exp": "\${2:exp_name}(\${3:exp_value})",
  "frequency": 0
}`,
  },
  {
    scope: 'json',
    name: 'words',
    tabTrigger: 'words',
    content: `"words": [\${1:}]`,
  },
  {
    scope: 'json',
    name: 'word',
    tabTrigger: 'word',
    content: `{
  "word": "\${1:word}",
  "exp": "\${2:exp_name}(\${3:exp_value})",
  "frequency": 0
}`,
  },
];

export const behaviorSnippets: ISnippet[] = [
  {
    scope: 'json',
    name: 'behaviorGroups',
    tabTrigger: 'behaviorGroups',
    content: `"behaviorGroups": [\${1:}]`,
  },
  {
    scope: 'json',
    name: 'behaviorGroup',
    tabTrigger: 'behaviorGroup',
    content: `{
  "name": "\${1:name}",
  "behaviorRules": [\${2:}]
}`,
  },
  {
    scope: 'json',
    name: 'behaviorRule',
    tabTrigger: 'behaviorRule',
    content: `{
  "name": "\${1:name}",
  "actions": [\${2:}],
  "children": [\${3:}]
}`,
  },
  // ---------- RuleChild -----------------
  {
    scope: 'json',
    name: 'inputmatcher',
    tabTrigger: 'inputmatcher',
    content: `{
  "type": "inputmatcher",
  "configs": {
    "expressions": "\${1:expressions}",
    "occurrence": "\${2:occurrence}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'contextmatcher:expressions',
    tabTrigger: 'contextmatcher:expressions',
    content: `{
  "type": "contextmatcher",
  "configs": {
    "contextType": "expressions",
    "contextKey": "\${1:contextKey}",
    "expressions": "\${2:expressions}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'contextmatcher:object',
    tabTrigger: 'contextmatcher:object',
    content: `{
  "type": "contextmatcher",
  "configs": {
    "contextType": "object",
    "contextKey": "\${1:contextKey}",
    "objectKeyPath": "\${2:objectKeyPath}",
    "objectValue": "\${3:objectValue}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'contextmatcher:string',
    tabTrigger: 'contextmatcher:string',
    content: `{
  "type": "contextmatcher",
  "configs": {
    "contextType": "string",
    "contextKey": "\${1:contextKey}",
    "string": "\${2:string}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'contextmatcher',
    tabTrigger: 'contextmatcher',
    content: `{
  "type": "contextmatcher",
  "configs": {
    "contextType": "\${1:contextType}",
    "contextKey": "\${2:contextKey}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'connector',
    tabTrigger: 'connector',
    content: `{
  "type": "connector",
  "configs": {
    "operator": "\${1:operator}",
  }
}`,
  },
  {
    scope: 'json',
    name: 'occurrence',
    tabTrigger: 'occurrence',
    content: `{
  "type": "occurrence",
  "configs": {
  "minTimesOccurred": \${1:minTimesOccurred},
  "maxTimesOccurred": \${2:maxTimesOccurred},
  "behaviorRuleName": "\${3:behaviorRuleName}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'dependency',
    tabTrigger: 'dependency',
    content: `{
  "type": "dependency",
  "configs": {
    "reference": "\${1:reference}",
  }
}`,
  },
  {
    scope: 'json',
    name: 'actionmatcher',
    tabTrigger: 'actionmatcher',
    content: `{
  "type": "actionmatcher",
  "configs": {
    "actions": "\${1:actions}",
    "occurrence": "\${2:occurrence}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'dynamicvaluematcher',
    tabTrigger: 'dynamicvaluematcher',
    content: `{
  "type": "dynamicvaluematcher",
  "configs": {
    "valuePath": "\${1:valuePath}",
    "contains": "\${2:contains}",
    "equals": "\${3:equals}"
  }
}`,
  },
];

export const outputSnippets: ISnippet[] = [
  {
    scope: 'json',
    name: 'outputset',
    tabTrigger: 'outputsets',
    content: `"outputset": [\${1:}]`,
  },
  {
    scope: 'json',
    name: 'output',
    tabTrigger: 'output',
    content: `{
  "action": "\${1:action}",
  "timesOccurred": \${2:0},
  "outputs": [\${3:}]
}`,
  },
  {
    scope: 'json',
    name: 'outputValue',
    tabTrigger: 'outputValue',
    content: `{
  "type": "\${1:type}",
  "valueAlternatives": [\${2:}]
}`,
  },
  {
    scope: 'json',
    name: 'quickReplies',
    tabTrigger: 'quickReplies',
    content: `"quickReplies": [\${1:}]`,
  },
  {
    scope: 'json',
    name: 'quickReply',
    tabTrigger: 'quickReply',
    content: `{
  "value": "\${1:value}",
  "expressions": "\${2:exp_name}(\${3:exp_value})"
}`,
  },
];

export const httpCallsSnippets: ISnippet[] = [
  {
    scope: 'json',
    name: 'targetServerUri',
    tabTrigger: 'targetServerUri',
    content: `"targetServerUri": "\${1:targetServerUri}"`,
  },
  {
    scope: 'json',
    name: 'httpCalls',
    tabTrigger: 'httpCalls',
    content: `"httpCalls": [\${1:}]`,
  },
  {
    scope: 'json',
    name: 'httpCall',
    tabTrigger: 'httpCall',
    content: `{
  "httpCall": "\${1:name}",
  "saveResponse": \${2:false},
  "fireAndForget": \${3:false},
  "responseObjectName": "\${4:responseObjectName}",
  "responseHeaderObjectName": "\${5:responseHeaderObjectName}",
  "isBatchCalls": \${6:false},
  "iterationObjectName": "\${7:iterationObjectName}",
  "actions": [\${8:}],
  "preRequest": \${9:{}},
  "request": \${10:{}},
  "postResponse": \${11:{}}
}`,
  },
  {
    scope: 'json',
    name: 'preRequest',
    tabTrigger: 'preRequest',
    content: `{
  "propertyInstructions": [\${1:}],
  "batchRequests": \${2:{}},
  "delayBeforeExecutingInMillis": \${3:0}
}`,
  },
  {
    scope: 'json',
    name: 'propertyInstruction',
    tabTrigger: 'propertyInstruction',
    content: `{
  "fromObjectPath": "\${1:fromObjectPath}",
  "toObjectPath": "\${2:toObjectPath}",
  "convertToObject": \${3:false},
  "override": \${4:true},
  "runOnValidationError": \${5:false},
  "httpCodeValidator": \${6:{}}
}`,
  },
  {
    scope: 'json',
    name: 'httpCodeValidator',
    tabTrigger: 'httpCodeValidator',
    content: `{
  "runOnHttpCode": [\${1:200, 201}],
  "skipOnHttpCode": [\${2:0, 400, 401, 402, 403, 404, 409, 410, 500, 501, 502}]
}`,
  },
  {
    scope: 'json',
    name: 'batchRequests',
    tabTrigger: 'batchRequests',
    content: `{
  "executeCallsSequentially": \${1:false}
}`,
  },
  {
    scope: 'json',
    name: 'request',
    tabTrigger: 'request',
    content: `{
  "path": "\${1:path}",
  "headers": \${2:{}},
  "queryParams": \${3:{}},
  "method": "\${4:GET}",
  "contentType": "\${5:}",
  "body": "\${6:}"
}`,
  },
  {
    scope: 'json',
    name: 'postResponse',
    tabTrigger: 'postResponse',
    content: `{
  "retryHttpCallInstruction": \${1:{}},
  "propertyInstructions": [\${2:}],
  "outputBuildInstructions": [\${3:}],
  "qrBuildInstructions": [\${4:}]
}`,
  },
  {
    scope: 'json',
    name: 'retryHttpCallInstruction',
    tabTrigger: 'retryHttpCallInstruction',
    content: `{
  "maxRetries": \${1:3},
  "exponentialBackoffDelayInMillis": \${2:1000},
  "retryOnHttpCodes": [\${3:502, 503}],
  "responseValuePathMatchers": [\${4:}]
}`,
  },
  {
    scope: 'json',
    name: 'responseValuePathMatcher',
    tabTrigger: 'responseValuePathMatcher',
    content: `{
  "valuePath": "\${1:valuePath}",
  "contains": "\${2:contains}",
  "equals": "\${3:equals}",
  "trueIfNoMatch": \${4:false}
}`,
  },
  {
    scope: 'json',
    name: 'outputBuildingInstruction',
    tabTrigger: 'outputBuildingInstruction',
    content: `{
  "outputType": "\${1:outputType}",
  "outputValue": "\${2:outputValue}",
  "httpCodeValidator": \${3:{}}
}`,
  },
  {
    scope: 'json',
    name: 'quickRepliesBuildingInstruction',
    tabTrigger: 'quickRepliesBuildingInstruction',
    content: `{
  "quickReplyValue": "\${1:quickReplyValue}",
  "quickReplyExpressions": "\${2:quickReplyExpressions}",
  "httpCodeValidator": \${3:{}}
}`,
  },
];

export const langChainSnippets: ISnippet[] = [
  {
    scope: 'json',
    name: 'tasks',
    tabTrigger: 'tasks',
    content: `"tasks": [
  \${1}
]`,
  },
  {
    scope: 'json',
    name: 'task',
    tabTrigger: 'task',
    content: `{
  "id": "\${1:task_1}",
  "type": "\${2:example_type}",
  "description": "\${3:This is an example task description}",
  "actions": [
    \${4:"action_1"},
    \${5:"action_2"}
  ],
  "preRequest": {
    "propertyInstructions": [
      {
        "name": "\${6:exampleProperty}",
        "valueString": "\${7:exampleValue}",
        "scope": "\${8:step}"
      }
    ]
  },
  "postResponse": {
    "propertyInstructions": [
      {
        "name": "\${9:exampleResponseProperty}",
        "valueString": "\${10:responseValue}",
        "scope": "\${11:conversation}"
      }
    ],
    "outputBuildInstructions": [
      {
        "pathToTargetArray": "\${12:response.data}",
        "iterationObjectName": "\${13:item}",
        "outputType": "\${14:exampleType}",
        "outputValue": "\${15:exampleOutputValue}"
      }
    ],
    "qrBuildInstructions": [
      {
        "pathToTargetArray": "\${16:response.quickReplies}",
        "iterationObjectName": "\${17:item}",
        "quickReplyValue": "\${18:exampleQuickReplyValue}",
        "quickReplyExpressions": "\${19:exampleExpression}"
      }
    ]
  },
  "parameters": {
    "exampleParameter": "\${20:exampleValue}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'actions',
    tabTrigger: 'actions',
    content: `"actions": [
  \${1:"any_action"}
]`,
  },
  {
    scope: 'json',
    name: 'preRequest',
    tabTrigger: 'preRequest',
    content: `"preRequest": {
  "propertyInstructions": [
    {
      "name": "\${1:exampleProperty}",
      "valueString": "\${2:exampleValue}",
      "scope": "\${3:step}"
    }
  ]
}`,
  },
  {
    scope: 'json',
    name: 'postResponse',
    tabTrigger: 'postResponse',
    content: `"postResponse": {
  "propertyInstructions": [
    {
      "name": "\${1:exampleResponseProperty}",
      "valueString": "\${2:responseValue}",
      "scope": "\${3:conversation}"
    }
  ],
  "outputBuildInstructions": [
    {
      "pathToTargetArray": "\${4:response.data}",
      "iterationObjectName": "\${5:item}",
      "outputType": "\${6:exampleType}",
      "outputValue": "\${7:exampleOutputValue}"
    }
  ],
  "qrBuildInstructions": [
    {
      "pathToTargetArray": "\${8:response.quickReplies}",
      "iterationObjectName": "\${9:item}",
      "quickReplyValue": "\${10:exampleQuickReplyValue}",
      "quickReplyExpressions": "\${11:exampleExpression}"
    }
  ]
}`,
  },
  {
    scope: 'json',
    name: 'parameters',
    tabTrigger: 'parameters',
    content: `"parameters": {
  "exampleParameter": "\${1:exampleValue}"
}`,
  },
  {
    scope: 'json',
    name: 'parameter',
    tabTrigger: 'parameter',
    content: `"param1": "\${1:value1}"`,
  }
];

export const propertySetterSnippets: ISnippet[] = [
  {
    scope: 'json',
    name: 'propertySetterConfiguration',
    tabTrigger: 'propertySetterConfiguration',
    content: `"propertySetterConfiguration": {
  "setOnActions": [\${1:}]
}`,
  },
  {
    scope: 'json',
    name: 'setOnActions',
    tabTrigger: 'setOnActions',
    content: `{
  "actions": [\${1:}],
  "setProperties": [\${2:}]
}`,
  },
  {
    scope: 'json',
    name: 'action',
    tabTrigger: 'action',
    content: `"\${1:action}"`,
  },
  {
    scope: 'json',
    name: 'propertyInstruction',
    tabTrigger: 'propertyInstruction',
    content: `{
  "fromObjectPath": "\${1:fromObjectPath}",
  "toObjectPath": "\${2:toObjectPath}",
  "convertToObject": \${3:false},
  "override": \${4:true},
  "runOnValidationError": \${5:false},
  "httpCodeValidator": \${6:{}}
}`,
  },
  {
    scope: 'json',
    name: 'httpCodeValidator',
    tabTrigger: 'httpCodeValidator',
    content: `{
  "runOnHttpCode": [\${1:200, 201}],
  "skipOnHttpCode": [\${2:400, 401, 402, 403, 404, 500, 501, 502}]
}`,
  },
];


export const packageSnippets: ISnippet[] = [
  {
    scope: 'json',
    name: 'packageExtensions',
    tabTrigger: 'packageExtensions',
    content: `"packageExtensions": [\${1:}]`,
  },
  {
    scope: 'json',
    name: 'behavior',
    tabTrigger: 'behavior',
    content: `{
  "type": "eddi://ai.labs.behavior",
  "config": {
    "uri": "\${1:uri}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'output',
    tabTrigger: 'output',
    content: `{
  "type": "eddi://ai.labs.output",
  "config": {
    "uri": "\${1:uri}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'corrections:stemming',
    tabTrigger: 'corrections:stemming',
    content: `{
  "type": "eddi://ai.labs.parser.corrections.stemming",
  "config": {
    "language": "\${1:english}",
    "lookupIfKnown": "\${2:false}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'corrections:levenshtein',
    tabTrigger: 'corrections:levenshtein',
    content: `{
  "type": "eddi://ai.labs.parser.corrections.levenshtein",
  "config": {
    "distance": "\${1:distance}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'corrections:stemming',
    tabTrigger: 'corrections:stemming',
    content: `{
  "type": "eddi://ai.labs.parser.corrections.stemming",
  "config": {
    "language": "\${1:english}",
    "lookupIfKnown": "\${2:false}"
  }
}`,
  },
  {
    scope: 'json',
    name: 'corrections:mergedTerms',
    tabTrigger: 'corrections:mergedTerms',
    content: `{
  "type": "eddi://ai.labs.parser.corrections.mergedTerms"
}`,
  },
  {
    scope: 'json',
    name: 'dictionaries:integer',
    tabTrigger: 'dictionaries:integer',
    content: `{
  "type": "eddi://ai.labs.parser.dictionaries.integer"
}`,
  },
  {
    scope: 'json',
    name: 'dictionaries:decimal',
    tabTrigger: 'dictionaries:decimal',
    content: `{
  "type": "eddi://ai.labs.parser.dictionaries.decimal"
}`,
  },
  {
    scope: 'json',
    name: 'dictionaries:punctuation',
    tabTrigger: 'dictionaries:punctuation',
    content: `{
  "type": "eddi://ai.labs.parser.dictionaries.punctuation"
}`,
  },
  {
    scope: 'json',
    name: 'dictionaries:email',
    tabTrigger: 'dictionaries:email',
    content: `{
  "type": "eddi://ai.labs.parser.dictionaries.email"
}`,
  },
  {
    scope: 'json',
    name: 'dictionaries:time',
    tabTrigger: 'dictionaries:time',
    content: `{
  "type": "eddi://ai.labs.parser.dictionaries.time"
}`,
  },
  {
    scope: 'json',
    name: 'dictionaries:ordinalNumber',
    tabTrigger: 'dictionaries:ordinalNumber',
    content: `{
  "type": "eddi://ai.labs.parser.dictionaries.ordinalNumber"
}`,
  },
  {
    scope: 'json',
    name: 'dictionaries:regular',
    tabTrigger: 'dictionaries:regular',
    content: `{
  "type": "eddi://ai.labs.parser.dictionaries.regular",
  "config": {
    "uri": "\${1:uri}"
  },
}`,
  },
  {
    scope: 'json',
    name: 'parser',
    tabTrigger: 'parser',
    content: `{
  "type": "eddi://ai.labs.parser",
  "extensions": {
    "dictionaries": [\${1:}],
    "corrections": [\${2:}],
  },
}`,
  },
];

export const botSnippets: ISnippet[] = [
  {
    scope: 'json',
    name: 'packages',
    tabTrigger: 'packages',
    content: `"packages": [\${1:}]`,
  },
  {
    scope: 'json',
    name: 'channels',
    tabTrigger: 'channels',
    content: `"channels": [\${1:}]`,
  },
];
