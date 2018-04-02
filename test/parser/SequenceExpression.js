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

import InputBuffer        from '../../src/parser/InputBuffer';
import SequenceExpression from '../../src/parser/SequenceExpression';

/**
 * Tests for sequence expressions in a grammar.
 */
describe('parser/SequenceExpression', function() {

	let sequenceExpression;
	beforeEach(function() {
		sequenceExpression = new SequenceExpression(/abc/, /123/);
	});

	test('A successful parse means all expressions in the sequence were successful', function() {
		let result = sequenceExpression.parse({
			input: new InputBuffer('abc123')
		});
		expect(result).toEqual(['abc', '123']);
	});

	test('A failed parse anywhere means the entire sequence has failed', function() {
		let result;

		result = sequenceExpression.parse({
			input: new InputBuffer('abcdef')
		});
		expect(result).toBeNull();

		result = sequenceExpression.parse({
			input: new InputBuffer('xyz')
		});
		expect(result).toBeNull();
	});

	test("If one expression fails, then don't carry on parsing", function() {
		let input = new InputBuffer('xyz123');
		let spy = jest.spyOn(input, 'read');
		let result = sequenceExpression.parse({ input });
		expect(result).toBeNull();
		expect(spy).toHaveBeenCalledTimes(1);
	});
});
