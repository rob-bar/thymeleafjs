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

import InputBuffer      from '../../src/parser/InputBuffer';
import Parser           from '../../src/parser/Parser';
import Rule             from '../../src/parser/Rule';
import SimpleExpression from '../../src/parser/SimpleExpression';

/**
 * Tests for the rule component of a grammar.
 */
describe('parser/Rule', function() {

	test('Gets its result from matching the configured expression', function() {
		let rule = new Rule('Test',
			new SimpleExpression(/Hello!/)
		);
		let result = rule.match(new InputBuffer('Hello!'), new Parser());
		expect(result).toBe('Hello!');
	});

	test('Result can be processed by a configured processor', function() {
		let rule = new Rule('Test',
			new SimpleExpression(/Hello!/),
			result => ({ result })
		);
		let result = rule.match(new InputBuffer('Hello!'), new Parser());
		expect(result).toEqual({ result: 'Hello!' });
	});

	test('A failed match returns `null`', function() {
		let rule = new Rule('Test',
			new SimpleExpression(/Hello!/)
		);
		let result = rule.match(new InputBuffer('Goodbye'), new Parser());
		expect(result).toBeNull();
	});
});
