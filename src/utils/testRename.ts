// Test file for renameSymbol function
import { renameSymbol } from './stParser'

const testCode = `PROGRAM Test_Program
VAR
  Counter : INT := 0;
  Enable : BOOL;
END_VAR

IF Enable THEN
  Counter := Counter + 1;
END_IF

END_PROGRAM`

console.log('Original code:')
console.log(testCode)
console.log('\n---\n')

const result = renameSymbol(testCode, 'Counter', 'MyCounter')

console.log('Result:')
console.log(result)
console.log('\n---\n')

console.log('New code:')
console.log(result.content)

// Test with special case
const testCode2 = `VAR
  test_var : INT;
END_VAR
test_var := 10;`

console.log('\n\n=== Test 2 ===')
console.log('Original:', testCode2)
const result2 = renameSymbol(testCode2, 'test_var', 'new_test_var')
console.log('Result:', result2)
console.log('New code:', result2.content)
