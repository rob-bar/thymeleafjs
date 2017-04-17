/*
 * Copyright 2017, Emanuel Rabina (http://www.ultraq.net.nz/)
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
'use strict';

const AttributeProcessor  = require('./AttributeProcessor');
const {processExpression} = require('../expressions/ExpressionProcessor');

const NAME = 'if';

/**
 * JS equivalent of Thymeleaf's `th:if` attribute processor, includes or
 * excludes the current element and its children from rendering, depending on
 * the evaluation of the expression in the attribute value.
 * 
 * @author Emanuel Rabina
 */
class StandardIfAttributeProcessor extends AttributeProcessor {

	/**
	 * Constructor, set this processor to use the `if` name.
	 */
	constructor() {

		super('th', NAME);
	}

	/**
	 * Processes an element that contains a `th:if` or `data-th-if` attribute
	 * on it, evaluating the expression for truthy/falsey, rendering/excluding the
	 * element and its children based on the result.
	 * 
	 * @param {Element} element 
	 *   Element being processed.
	 * @param {String} attribute
	 *   The attribute that was encountered to invoke this processor.
	 * @param {String} attributeValue
	 *   The value given by the attribute.
	 * @param {Object} context
	 */
	process(element, attribute, attributeValue, context) {

		let expressionResult = processExpression(attributeValue, context);
		if (!expressionResult) {
			while (element.firstChild) {
				element.removeChild(element.firstChild);
			}
			element.parentNode.removeChild(element);
		}
		element.removeAttribute(attribute);
	}
}

StandardIfAttributeProcessor.NAME = NAME;

module.exports = StandardIfAttributeProcessor;