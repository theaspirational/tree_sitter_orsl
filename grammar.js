const PREC = {

  conditional: -1,
  ternary_expression: -2,
  supermap_case: -3,

  parenthesized_expression: 1,

  or: 10,
  and: 11,
  not: 12,
  compare: 13,
  bitwise_or: 14,
  bitwise_and: 15,
  xor: 16,
  shift: 17,
  plus: 18,
  times: 19,
  unary: 20,
  power: 21,

  supermap: 22,


  runif: 23,
  init: 24,
  boolean_block: 24,
  any_block: 25,
  any_call: 26,

  call: 27,
}

const SEMICOLON = ';'

module.exports = grammar({
  name: 'orsl',

  extras: $ => [
    $.comment,
    /[\s\f\uFEFF\u2060\u200B]|\r?\n/,
    $.line_continuation,
  ],

  conflicts: $ => [
    // [$.primary_expression, $._left_hand_side],
    [$.primary_expression, $.concatenated_string],
    [$.call, $.overridable_call],
    [$.expression, $.supermap_case],
  ],

  supertypes: $ => [
    $._simple_statement,
    $._compound_statement,
    $.expression,
    $.primary_expression,
    $.parameter,
  ],

  externals: $ => [
    $.newline,
    $._indent,
    $._dedent,
    $.string_start,
    $._string_content,
    $.string_end,

    // Mark comments as external tokens so that the external scanner is always
    // invoked, even if no external token is expected. This allows for better
    // error recovery, because the external scanner can maintain the overall
    // structure by returning dedent tokens whenever a dedent occurs, even
    // if no dedent is expected.
    $.comment,

    // Allow the external scanner to check for the validity of closing brackets
    // so that it can avoid returning dedent tokens between brackets.
    ']',
    ')',
    // '}',
  ],

  word: $ => $.identifier,

  rules: {

    script_file: $ => repeat($.namespace),

    namespace: ($) =>
      seq(
        'namespace',
        field('name', $.identifier),
        ':',
        $.newline,
        $._indent,
        field("body", $.namespace_body),
        $._dedent
      ),

    namespace_body: $ => repeat1(
      $.context),

    context: ($) =>
      seq(
        'context',
        field("context_type", $.context_type),
        ':',
        $.newline,
        $._indent,
        field('body', $.context_body),
        $._dedent
      ),

    context_type: ($) =>
      choice(
        "global",
        "client_order",
        "venue_order",
        "venue_fill",
        $.identifier
      ),

    context_body: $ => repeat1(choice(
      $.user_variables,
      $.user_marks,
      $.function_definition,
      $._procedure_definitions,
    )),

    user_variables: $ => seq(
      'user-variables',
      ":",
      $.newline,
      $._indent,
      field("body", $.user_variables_body),
      $._dedent
    ),

    user_variables_body: $ => repeat1(
      field("assignment", $.user_variable_assignment)),

    user_marks: $ => seq(
      'user-marks',
      ":",
      $.newline,
      $._indent,
      field("body", $.user_marks_body),
      $._dedent
    ),

    user_marks_body: $ => repeat1(seq(field("mark", $.typed_identifier), $.newline)),

    function_definition: $ => seq(
      'function',
      field('return_type', $.type),
      field('name', $.identifier),
      field('parameters', $.parameters),
      ':',
      field('body', $._suite)
    ),

    _suite: $ => choice(
      alias($._simple_statements, $.block),
      seq($._indent, $.block),
      alias($.newline, $.block)
    ),

    block: $ => seq(
      repeat($._statement),
      $._dedent
    ),

    parameters: $ => seq(
      '(',
      optional($._parameters),
      ')'
    ),

    _parameters: $ => seq(
      commaSep1($.parameter),
      optional(',')
    ),

    parameter: $ => choice(
      $.identifier,
      $.default_parameter
    ),

    default_parameter: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $.expression)
    ),

    params_maping: $ => seq(
      '...',
    ),

    _procedure_definitions: $ => choice(
      $.procedure_definition,
      $.annotated_procedure
    ),

    procedure_definition: $ => seq(
      'procedure',
      field('name', $.identifier),
      field('parameters', $.parameters),
      ':',
      $.newline,
      $._indent,
      field('body', $.procedure_body),
      $._dedent
    ),

    annotated_procedure: $ => seq(
      repeat1($.annotation),
      field('procedure', $.procedure_definition)
    ),

    annotation: $ => seq(
      '@',
      field('annotation', $.identifier),
      $.newline),

    procedure_body: $ => repeat1(choice(
      $.runif_block,
      $.init_block,
      $.map_block,
      $.sequence_block,
    )),

    runif_block: $ => prec.left(PREC.runif, seq(
      'runif',
      ':',
      $.newline,
      $._indent,
      field("body", $.runif_body),
      $._dedent
    )),

    runif_body: $ => repeat1(
      choice(
        $.primary_expression,
        $.if_statement,
        $.comparison_operator,
        $.boolean_block,
      )),

    init_block: $ => prec.left(PREC.init, seq(
      'init',
      ':',
      $.newline,
      $._indent,
      field('body', $.init_body),
      $._dedent
    )),

    init_body: $ => repeat1($._statement),

    // repeat1(
    //   choice(
    //     $.if_statement,
    //     $.assignment,
    //     $.comparison_operator,
    //     $.boolean_block,

    //   )),

    map_block: $ => seq(
      'map',
      ':',
      $.newline,
      $._indent,
      field('body', $.map_body),
      $._dedent
    ),

    map_body: $ => repeat1($._statement),

    sequence_block: $ => seq(
      'sequence',
      ':',
      $.newline,
      $._indent,
      field('body', $.sequence_body),
      $._dedent
    ),

    sequence_body: $ => repeat1(
      choice(
        $._statement,
        $.any_call,
        $.any_block,
      )),

    any_block: $ => prec.left(PREC.any_block, seq(
      'any',
      ':',
      $.newline,
      $._indent,
      field('body', $.any_body),
      $._dedent
    )),

    any_call: $ => prec.left(PREC.any_call, seq(
      'any',
      field('parameters', $.parameters),
      ':',
      $.newline,
      $._indent,
      field('body', $.any_body),
      $._dedent
    )),

    any_body: $ => repeat1($._statement),

    assignment: $ => seq(
      field('left', $._left_hand_side),
      choice(
        seq('=', field('right', $._right_hand_side)),
        seq(':', field('right', $._right_hand_side)),
      ),
      $.newline
    ),

    user_variable_assignment: $ => seq(
      field('left', $.typed_identifier),
      '=',
      field('right', $._right_hand_side),
      $.newline
      ),

    _left_hand_side: $ => choice(
      $.identifier,
      $.subscript,
      $.attribute,
      $.typed_identifier,
    ),

    typed_identifier: $ => seq(
      field('type', $.type),
      field('name', $.identifier)
    ),

    _right_hand_side: $ => choice(
      $.expression,
      $.expression_list
    ),

    _statement: $ => choice(
      $._simple_statements,
      $._compound_statement
    ),

    // Simple statements

    _simple_statements: $ => seq(
      sep1($._simple_statement, SEMICOLON),
      optional(SEMICOLON),
      $.newline
    ),

    _simple_statement: $ => choice(
      $.expression_statement,
      $.return_statement,
    ),

    expression_statement: $ => choice(
      $.expression,
      $.assignment,
    ),

    return_statement: $ => seq(
      'return',
      $.expression
    ),

    // Compound statements
    _compound_statement: $ => choice(
      $.if_statement,
      $.boolean_block,
      $.function_definition,
    ),

    if_statement: $ => seq(
      'if',
      field('condition', $.expression),
      ':',
      field('consequence', $._suite),
      repeat(field('alternative', $.elif_clause)),
      optional(field('alternative', $.else_clause))
    ),

    elif_clause: $ => seq(
      'elif',
      field('condition', $.expression),
      ':',
      field('consequence', $._suite)
    ),

    else_clause: $ => seq(
      'else',
      ':',
      field('body', $._suite)
    ),

    // Expressions
    expression: $ => choice(
      $.comparison_operator,
      $.boolean_operator,
      $.primary_expression,
      $.ternary_expression,
      $.not_operator,
    ),

    primary_expression: $ => choice(
      $.binary_operator,
      $.identifier,
      $.string,
      $.concatenated_string,
      $.integer,
      $.float,
      $.true,
      $.false,
      $.none,
      $.unary_operator,
      $.attribute,
      $.subscript,
      $.call,
      $.overridable_call,
      $.supermap,
      $.list,
      $.parenthesized_expression,
    ),

    not_operator: $ => prec(PREC.not, seq(
      'not',
      field('argument', $.expression)
    )),

    parenthesized_expression: $ => prec(PREC.parenthesized_expression, seq(
      '(',
      $.expression,
      ')'
    )),

    boolean_block: $ => prec.left(PREC.boolean_block, seq(
      field("operator", choice("or", "and", "not")),
      ':',
      $.newline,
      $._indent,
      field("body", $.boolean_block_body),
      $._dedent
    )),

    boolean_block_body: $ => repeat1($.expression),

    boolean_operator: $ => choice(

      prec.left(PREC.and, seq(
        field('left', $.expression),
        field('operator', 'and'),
        field('right', $.expression)
      )),
      prec.left(PREC.or, seq(
        field('left', $.expression),
        field('operator', 'or'),
        field('right', $.expression)
      ))
    ),

    comparison_operator: $ => prec.left(PREC.compare, seq(
      $.primary_expression,
      repeat1(seq(
        field('operators',
          choice(
            '<',
            '<=',
            '==',
            '!=',
            '>=',
            '>',
            '<>',
            'in',
            alias(seq('not', 'in'), 'not in'),
            'is',
            alias(seq('is', 'not'), 'is not')
          )),
        $.primary_expression,
        // $.newline
      ))
    )),

    ternary_expression: $ => prec.right(PREC.ternary_expression, seq(
      field("condition", $.expression),
      '?',
      field("consequence", $.expression),
      ':',
      field("alternative", $.expression)
    )),

    expression_list: $ => prec.right(seq(
      $.expression,
      choice(
        ',',
        seq(
          repeat1(seq(
            ',',
            $.expression
          )),
          optional(',')
        ),
      )
    )),

    list: $ => seq(
      '[',
      optional($._collection_elements),
      ']'
    ),

    _collection_elements: $ => seq(
      commaSep1(
        $.expression
      ),
      optional(',')
    ),

    call: $ => prec(PREC.call, seq(
      field('function', $.primary_expression),
      field('arguments', $.argument_list
      )
    )),

    overridable_call: $ => prec(PREC.call, seq(
      field('override', $.primary_expression),
      field('arguments', $.argument_list),
      ":",
      field('body', $._suite),
    )),

    supermap: $ => prec.left(PREC.supermap, seq(
      'supermap',
      field('arguments', $.argument_list),
      ':',
      $.newline,
      $._indent,
      field('body', $.supermap_body),
      $._dedent
    )),

    supermap_body: $ => seq(
        repeat1(
          $.supermap_condition_expression,
        ),
        optional($.supermap_default_case)),

    supermap_condition_expression: $ => seq(
      field('condition', $.supermap_condition),
      ':',
      $.newline,
      $._indent,
      field('body', $.supermap_condition_body),
      $._dedent
    ),

    supermap_condition: $ => seq(
      choice(
        $.comparison_operator,
        $.boolean_operator,
        $.primary_expression,
        $.ternary_expression,
        $.not_operator,
      ),
      optional($.supermap_case),
    ),

    supermap_case: $ => prec.left(PREC.supermap_case, seq(
      SEMICOLON,
      optional("("),
      repeat1($.primary_expression),
      optional(")"),
    )),

    supermap_condition_body: $ => repeat1(
      choice(
        $.supermap_boolean_block,
        $.supermap_pattern,
        $.supermap_default_case
      )
    ),

    supermap_pattern: $ => seq(
      $.primary_expression,
      '=>',
      $.expression,
      $.newline
    ),

    supermap_default_case: $ => seq(
      '=>',
      $.expression,
      $.newline
    ),

    supermap_boolean_block: $ => prec.left(PREC.boolean_block, seq(
      field("predicate", $.primary_expression),
      ':',
      $.newline,
      $._indent,
      field("body", $.supermap_boolean_block_body),
      $._dedent
    )),

    supermap_boolean_block_body: $ => repeat1($.supermap_pattern),


    argument_list: $ => seq(
      '(',
      optional(commaSep1(
        choice(
          $.expression,
          $.keyword_argument,
          $.params_maping
        )
      )),
      optional(','),
      ')'
    ),

    keyword_argument: $ => seq(
      field('name', $.identifier),
      '=',
      field('value', $.expression)
    ),

    // TODO: ask about context aware attributes
    attribute: $ => prec(PREC.call, seq(
      field('ctx', $.primary_expression),
      '.',
      field('attribute', $.identifier)
    )),

    subscript: $ => prec(PREC.call, seq(
      field('value', $.primary_expression),
      '[',
      commaSep1(field('subscript', $.expression)),
      optional(','),
      ']'
    )),

    unary_operator: $ => prec(PREC.unary, seq(
      field('operator', choice('+', '-', '~', '!')),
      field('argument', $.primary_expression)
    )),

    binary_operator: $ => {
      const table = [
        [prec.left, '+', PREC.plus],
        [prec.left, '-', PREC.plus],
        [prec.left, '*', PREC.times],
        [prec.left, '@', PREC.times],
        [prec.left, '/', PREC.times],
        [prec.left, '%', PREC.times],
        [prec.left, '//', PREC.times],
        [prec.right, '**', PREC.power],
        [prec.left, '|', PREC.bitwise_or],
        [prec.left, '&', PREC.bitwise_and],
        [prec.left, '^', PREC.xor],
        [prec.left, '<<', PREC.shift],
        [prec.left, '>>', PREC.shift],
      ];

      return choice(...table.map(([fn, operator, precedence]) => fn(precedence, seq(
        field('left', $.primary_expression),
        field('operator', operator),
        field('right', $.primary_expression)
      ))));
    },

    concatenated_string: $ => prec.right(seq(
      $.string,
      repeat1($.string)
    )),

    string: $ => seq(
      $.string_start,
      repeat($.string_content),
      $.string_end,
    ),

    string_content: $ => prec.right(repeat1(
      choice(
        $.escape_sequence,
        $._not_escape_sequence,
        $._string_content
      ))),

    escape_sequence: $ => token.immediate(prec(1, seq(
      '\\',
      choice(
        /u[a-fA-F\d]{4}/,
        /U[a-fA-F\d]{8}/,
        /x[a-fA-F\d]{2}/,
        /\d{3}/,
        /\r?\n/,
        /['"abfrntv\\]/,
        /N\{[^}]+\}/,
      )
    ))),

    _not_escape_sequence: $ => token.immediate('\\'),

    integer: $ => token(choice(
      seq(
        choice('0x', '0X'),
        repeat1(/_?[A-Fa-f0-9]+/),
        optional(/[Ll]/)
      ),
      seq(
        choice('0o', '0O'),
        repeat1(/_?[0-7]+/),
        optional(/[Ll]/)
      ),
      seq(
        choice('0b', '0B'),
        repeat1(/_?[0-1]+/),
        optional(/[Ll]/)
      ),
      seq(
        repeat1(/[0-9]+_?/),
        choice(
          optional(/[Ll]/), // long numbers
          optional(/[jJ]/) // complex numbers
        )
      )
    )),

    float: $ => {
      const digits = repeat1(/[0-9]+_?/);
      const exponent = seq(/[eE][\+-]?/, digits)

      return token(seq(
        choice(
          seq(digits, '.', optional(digits), optional(exponent)),
          seq(optional(digits), '.', digits, optional(exponent)),
          seq(digits, exponent)
        ),
        optional(choice(/[Ll]/, /[jJ]/))
      ))
    },

    comment: $ => token(seq('#', /.*/)),

    line_continuation: $ => token(seq('\\', choice(seq(optional('\r'), '\n'), '\0'))),

    identifier: $ => /[_\p{XID_Start}][_\p{XID_Continue}]*/,

    true: $ => 'True',
    false: $ => 'False',
    none: $ => 'None',

    type: $ => choice('Bool', 'Map', 'String', 'Int', 'Float', 'List', 'SeqList', 'Set', 'Tuple', 'Any', 'Void'),

  }
});

function commaSep1(rule) {
  return sep1(rule, ',')
}

function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)))
}