/* 
 * Copyright 2018, Emanuel Rabina (http://www.ultraq.net.nz/)
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {AllInput}          from './AllInput';
import ExpressionProcessor from './ExpressionProcessor';
import Grammar             from '../../parser/Grammar';
import {
	Optional,
	OneOrMore,
	OrderedChoice,
	Sequence,
	ZeroOrMore
} from '../../parser/Operators';
import {RegularExpression} from '../../parser/RegularExpression';
import Rule                from '../../parser/Rule';

import {flatten, remove}   from '@ultraq/array-utils';

// For helping identify rules that return objects
const METADATA_FRAGMENT  = 'fragment';
const METADATA_ITERATION = 'iteration';
const METADATA_METHOD    = 'method';

/**
 * Grammar for the Thymeleaf expression language.  Describes the language and
 * how to parse it.
 * 
 * @author Emanuel Rabina
 */
export default new Grammar('Thymeleaf Expression Language',

	// Ordered as at https://www.thymeleaf.org/doc/tutorials/3.0/usingthymeleaf.html#standard-expression-syntax
	new Rule('ThymeleafExpression',
		OrderedChoice(
			AllInput('VariableExpression'),
			AllInput('LinkExpression'),
			AllInput('FragmentExpression'),
			AllInput('Iteration'),
			AllInput('StringConcatenation'),
			AllInput('Literal'),
			AllInput('LogicalExpression'),
			AllInput('IfThenCondition'),
			AllInput('IfThenElseCondition'),
			AllInput('Nothing')
		)
	),


	// Simple expressions
	// ==================

	/**
	 * Variable expressions, `${variable}`.  Represents a value to be retrieved
	 * from the current context.  Also is an entry into the underlying expression
	 * language, so this part often extends to do what OGNL (and thus SpEL) can
	 * do.
	 */
	new Rule('VariableExpression',
		Sequence(/\${/, 'Chain', /\}/),
		([, chain]) => context => chain(context) || ''
	),
	new Rule('Chain',
		Sequence('ChainLink', ZeroOrMore(Sequence(/\./, 'ChainLink'))),
		(chain) => context => {
			return flatten(chain).filter(link => link !== '.').reduce((previousLink, nextLinkRule) => {
				let nextLink = nextLinkRule(context);
				if (previousLink && nextLink !== null && nextLink !== undefined) {
					if (typeof nextLink === 'object') {
						if (nextLink.type === METADATA_METHOD) {
							return previousLink[nextLink.name].apply(previousLink, nextLink.parameters(context));
						}
						else {
							// Any other metadata objects in a chain?
						}
					}
					else {
						return previousLink[nextLink];
					}
				}
				return previousLink;
			}, context);
		}
	),
	new Rule('ChainLink',
		OrderedChoice('ExpressionObject', 'MethodCall', 'PropertyName', 'Literal')
	),
	new Rule('ExpressionObject',
		Sequence(/#/, OrderedChoice('MethodCall', 'PropertyName')),
		([, object]) => () => object
	),

	/**
	 * Link expressions, `@{url(parameters)}`.  Used for generating URLs out of
	 * context parameters.
	 */
	new Rule('LinkExpression',
		RegularExpression(/^@\{(.+?)(\(.+\))?\}$/, ['Url', 'UrlParameters']),
		([, url, parameters]) => context => {

			if (parameters) {

				// TODO: Push this parsing of the parameters list back into the grammar
				let expressionProcessor = new ExpressionProcessor(context);
				let paramsList = parameters.slice(1, -1).split(',').map(param => {
					let [lhs, rhs] = param.split('=');
					return [lhs, expressionProcessor.process(rhs)];
				});

				// Fill out any placeholders in the URL from the parameters
				while (true) { // eslint-disable-line
					let urlTemplate = /(.*?)\{(.+?)\}(.*)/.exec(url);
					if (urlTemplate) {
						let [, head, placeholder, tail] = urlTemplate;
						let paramEntry = remove(paramsList, ([lhs]) => lhs === placeholder);
						if (paramEntry) {
							url = `${head}${paramEntry[1]}${tail}`;
						}
					}
					else {
						break;
					}
				}

				// Remaining parameters become search query parameters
				if (paramsList.length) {
					url += `?${paramsList.map(([key, value]) => `${key}=${value}`).join('&')}`;
				}
			}
			return url;
		}
	),
	new Rule('Url', /.+/),
	new Rule('UrlParameters', /\((.+)\)/),

	/**
	 * Fragment expressions, `~{template :: fragment(parameters)}`.  A locator for
	 * a piece of HTML in the same or another template.
	 */
	new Rule('FragmentExpression',
		Sequence(/~{/, 'TemplateName', /::/, 'FragmentName', 'FragmentParameters', /}/),
		([, templateName, , fragmentName, parameters]) => () => {

			// TODO: Should executing a fragment expression locate and return the
			//       fragment?  If so, then it'll make expression execution
			//       asynchronous!
			return {
				type: METADATA_FRAGMENT,
				templateName,
				fragmentName,
				parameters
			};
		}
	),
	new Rule('TemplateName', /[\w-._/]+/),
	new Rule('FragmentName', /[\w-._]+/),

	// TODO: We're not doing anything with these yet
	new Rule('FragmentParameters',
		Optional(/\(.+\)/)
	),


	// Complex expressions
	// ===================

	/**
	 * Iteration, `localVar : ${collection}`.  The name of the variable for each
	 * loop, followed by the collection being iterated over.
	 */
	new Rule('Iteration',
		Sequence('Identifier', Optional(Sequence(/,/, 'Identifier')), /:/, 'VariableExpression'),
		([localValueName, [, iterationStatusVariable], , collectionExpressionAction]) => context => ({
			type: METADATA_ITERATION,
			localValueName,
			iterable: collectionExpressionAction(context),
			iterationStatusVariable
		})
	),

	/**
	 * String concatenation, `'...' + '...'` or even `${...} + ${...}`, the
	 * joining of 2 expressions by way of the `+` operator.
	 */
	new Rule('StringConcatenation',
		Sequence('Concatenatable', OneOrMore(Sequence(/\+/, 'Concatenatable'))),
		([first, [...rest]]) => context => {
			const coerce = value => typeof value === 'function' ? value(context) : value.toString();
			return coerce(first) + rest.reduce((result, [, item]) => result + coerce(item), '');
		}
	),
	new Rule('Concatenatable',
		OrderedChoice(
			'StringLiteral',
			'VariableExpression'
		)
	),


	// Literals
	// ========

	new Rule('Literal',
		OrderedChoice(
			'StringLiteral',
			'NumberLiteral',
			'BooleanLiteral',
			'NullLiteral',
			'TokenLiteral'
		)
	),

	/**
	 * String literal, characters surrounded by `'` (single quotes).
	 */
	new Rule('StringLiteral', /'.*?'/, result => () => result.slice(1, -1)),

	/**
	 * A number.
	 */
	new Rule('NumberLiteral', /\d+(\.\d+)?/, result => () => parseFloat(result)),

	/**
	 * One of `true` or `false`.
	 */
	new Rule('BooleanLiteral', /(true|false)/, result => () => result === 'true'),

	/**
	 * The word `null` to represent the null value.
	 */
	// TODO: The parser uses null to mean 'failed parse', so this might not work?
	new Rule('NullLiteral', /null/, () => () => null),

	/**
	 * A token literal, which is pretty much anything else that can't be categorized
	 * by the other literal types.  This is often used as a fallback in the
	 * expression language so that, for any unknown input, we're still returning
	 * something.
	 */
	// TODO: Is this the same as an Identifier?
	new Rule('TokenLiteral', /[^: ${}]+/, result => () => result),


	// Text operations
	// ===============


	// Arithmetic operations
	// =====================


	// Boolean operations
	// ==================


	// Comparisons and equality
	// ========================

	/**
	 * A logical expression is any expression that resolves to a `true`/`false`
	 * value.
	 */
	new Rule('LogicalExpression',
		Sequence('Expression', 'Comparator', 'Expression'),
		([leftOperand, comparator, rightOperand]) => context => {
			let lhs = leftOperand(context);
			let rhs = rightOperand(context);
			switch (comparator) {
				case '==':  return lhs == rhs;
				case '===': return lhs === rhs;
			}
			return false;
		}
	),
	new Rule('Comparator',
		OrderedChoice(
			/===?/
		)
	),


	// Conditional operators
	// =====================

	/**
	 * If-then condition, `if ? then`.  This is the truthy branch only of the
	 * classic ternary operator.  The falsey branch is a no-op.
	 */
	new Rule('IfThenCondition',
		Sequence('Condition', /\?/, 'Expression'),
		([condition, , truthyExpression]) => context => {
			return condition(context) ? truthyExpression(context) : undefined;
		}
	),

	/**
	 * If-then-else condition, `if ? then : else`, the classic ternary operator.
	 */
	new Rule('IfThenElseCondition',
		Sequence('Condition', /\?/, 'Expression', /:/, 'Expression'),
		([condition, , truthyExpression, , falseyExpression]) => context => {
			return condition(context) ? truthyExpression(context) : falseyExpression(context);
		}
	),

	/**
	 * A condition is some expression or value that resolves to a true/false
	 * value.
	 */
	new Rule('Condition',
		OrderedChoice(
			'LogicalExpression',
			'Expression'
		)
	),


	// Special tokens
	// ==============

	/**
	 * An expression that matches the empty string.
	 */
	new Rule('Nothing', /^$/),


	// Common language basics
	// ======================

	new Rule('Identifier', /[a-zA-Z_][\w]*/),
	new Rule('PropertyName', 'Identifier', propertyName => () => propertyName),
	new Rule('MethodCall',
		Sequence('MethodName', /\(/, 'MethodParameters', /\)/),
		([name, , parameters]) => ({
			type: METADATA_METHOD,
			name,
			parameters
		})
	),
	new Rule('MethodName', 'Identifier'),
	new Rule('MethodParameters',
		Optional(Sequence('Expression', ZeroOrMore(Sequence(/,/, 'Expression')))),
		(parametersAndSeparators) => context => parametersAndSeparators ?
			flatten(parametersAndSeparators).filter(item => item !== ',').map(parameter => parameter(context)) :
			[]
	),

	/**
	 * Any valid unit of code that resolves to some value.
	 */
	new Rule('Expression',
		OrderedChoice(
			'VariableExpression',
			'Literal'
		)
	)
);
