/**
 * Greets a person with a personalized message
 * @param name - The name of the person to greet
 * @returns A greeting message
 */
export function greet(name: string): string {
  if (!name || name.trim().length === 0) {
    return 'Hello, stranger!';
  }
  
  return `Hello, ${name.trim()}!`;
}