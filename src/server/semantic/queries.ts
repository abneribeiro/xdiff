// Tree-sitter S-expression queries, embedded as strings so no .scm assets need
// to be copied at build time. Each pattern captures:
//   @def    — the whole definition node (its type determines the kind)
//   @name   — the identifier node
//   @params — (optional) the parameter list, for signature-change detection
//
// Grammar key → query source. Keys map to tree-sitter-wasms grammars.

export const QUERIES: Record<string, string> = {
  typescript: `
    (function_declaration name: (identifier) @name parameters: (formal_parameters) @params) @def
    (method_definition name: (property_identifier) @name parameters: (formal_parameters) @params) @def
    (class_declaration name: (type_identifier) @name) @def
    (interface_declaration name: (type_identifier) @name) @def
    (variable_declarator
      name: (identifier) @name
      value: (arrow_function parameters: (formal_parameters) @params)) @def
  `,
  go: `
    (function_declaration name: (identifier) @name parameters: (parameter_list) @params) @def
    (method_declaration name: (field_identifier) @name parameters: (parameter_list) @params) @def
    (type_spec name: (type_identifier) @name type: (struct_type)) @def
    (type_spec name: (type_identifier) @name type: (interface_type)) @def
  `,
};

// tsx reuses the typescript query (same node/field names).
QUERIES.tsx = QUERIES.typescript!;

// JavaScript grammar has no interfaces and uses (identifier) for class names.
QUERIES.javascript = `
  (function_declaration name: (identifier) @name parameters: (formal_parameters) @params) @def
  (method_definition name: (property_identifier) @name parameters: (formal_parameters) @params) @def
  (class_declaration name: (identifier) @name) @def
  (variable_declarator
    name: (identifier) @name
    value: (arrow_function parameters: (formal_parameters) @params)) @def
`;
