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

/**
 * Default processor which returns the result as is.
 * 
 * @template T
 * @param {T} result
 * @return {T}
 */
function defaultMatchProcessor(result) {
	return result;
}

/**
 * A rule describes a string in the language.
 * 
 * @author Emanuel Rabina
 */
export default class Rule {

	/**
	 * @member {String}
	 */
	name;

	/**
	 * @member {Object
	 */
	expression;

	/**
	 * @param {String} name
	 * @param {Object} expression
	 * @param {Function} [matchProcessor=defaultExpressionAction]
	 */
	constructor(name, expression, matchProcessor = defaultMatchProcessor) {

		this.name           = name;
		this.expression     = expression;
		this.matchProcessor = matchProcessor;
	}

	/**
	 * Check whether or not the input can be matched by this rule.
	 * 
	 * @param {InputBuffer} input
	 * @param {Parser} parser
	 * @return {Object}
	 */
	match(input, parser) {

		let matchResult = this.expression.match(input, parser);
		return matchResult !== null ? this.matchProcessor(matchResult) : null;
	}
}
