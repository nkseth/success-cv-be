import { createAzure } from '@ai-sdk/azure';
import { generateObject, generateText } from 'ai';

// Create Azure provider with explicit configuration
const azure = createAzure({
  resourceName: process.env.AZURE_RESOURCE_NAME,
  apiKey: process.env.AZURE_API_KEY,
});

const generateAiResponseObject = async ({ system, content, schema, model = 'gpt-35-turbo-0613', retries = 3 }) => {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!system || !content || !schema) {
        throw new Error('Missing required parameters: system, content, or schema');
      }

      // Ensure content is properly formatted as an array of message objects
      const messages = Array.isArray(content)
        ? content
        : [{ role: "user", content: content }];

      console.log(`AI object generation attempt ${attempt}/${retries}`);

      // Try with repaired schema that's more lenient
      let completion;
      try {
        completion = await generateObject({
          model: azure("gpt-4o-mini", {
            // Disable structured outputs - Azure uses JSON mode instead
            structuredOutputs: false,
          }),
          system,
          messages,
          schema,
          temperature: 0.2,
        });
      } catch (schemaError) {
        // If schema validation fails, try to extract and parse the JSON manually
        if (schemaError.name === 'AI_NoObjectGeneratedError' && schemaError.text) {
          console.log('Schema validation failed, attempting manual JSON parse with Zod safeParse...');
          try {
            const rawJson = JSON.parse(schemaError.text);
            // Use Zod's safeParse which is lenient and fills in defaults
            const parseResult = schema.safeParse(rawJson);
            if (parseResult.success) {
              console.log('Manual parse successful with defaults applied');
              completion = { object: parseResult.data };
            } else {
              console.log('Zod safeParse failed:', parseResult.error.issues.slice(0, 3));
              // Even if safeParse fails, return the raw data with defaults
              // This is better than failing completely
              const partialData = schema.partial().safeParse(rawJson);
              if (partialData.success) {
                console.log('Partial parse successful, returning with defaults');
                completion = { object: partialData.data };
              } else {
                throw schemaError; // Re-throw original error
              }
            }
          } catch (parseError) {
            if (parseError === schemaError) throw parseError;
            console.error('Manual JSON parse failed:', parseError.message);
            throw schemaError;
          }
        } else {
          throw schemaError;
        }
      }

      if (!completion || !completion.object) {
        throw new Error('No object generated: AI response was empty or invalid');
      }

      // Log what we received for debugging
      console.log('AI response object keys:', Object.keys(completion.object));

      // Validate that we have at least the minimum required fields
      // Support both resume parsing schema (personal_info, experiences, education)
      // and resume optimization schema (summary, experience, skills)
      const obj = completion.object;
      const hasParsingData = obj.personal_info || 
                            (obj.experiences && obj.experiences.length > 0) ||
                            (obj.education && obj.education.length > 0);
      const hasOptimizationData = obj.summary || 
                                  (obj.experience && obj.experience.length > 0) ||
                                  obj.skills;
      const hasMinimumData = hasParsingData || hasOptimizationData;
      
      if (!hasMinimumData) {
        console.error('AI response object (first 500 chars):', JSON.stringify(completion.object).substring(0, 500));
        throw new Error('Generated object lacks minimum required data (personal_info/experiences/education for parsing, or summary/experience/skills for optimization)');
      }

      console.log('AI object generation successful on attempt', attempt);
      return completion.object;
      
    } catch (error) {
      lastError = error;
      
      console.error(`AI Response Generation Error (attempt ${attempt}/${retries}):`, {
        message: error.message,
        name: error.name,
        cause: error.cause?.message || 'No cause provided',
        responseText: error.text || error.response?.text || 'No response text available',
        model: model
      });
      
      // Enhanced error handling with more specific error messages
      if (error.message.includes('rate limit')) {
        console.log(`Rate limit hit, waiting before retry ${attempt}/${retries}...`);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
          continue;
        }
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.message.includes('auth')) {
        throw new Error('Authentication error with Azure AI service.');
      } else if (error.message.includes('token')) {
        console.error('Token limit exceeded, cannot retry');
        throw new Error(`Token limit exceeded: ${error.message}`);
      }
      
      // For schema validation errors or generic failures, retry with backoff
      if (attempt < retries) {
        const waitTime = 1000 * attempt;
        console.log(`Retrying in ${waitTime}ms... (attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }
  }
  
  // All retries exhausted
  console.error('All retry attempts exhausted');
  
  if (lastError?.message?.includes('schema')) {
    throw new Error(`Schema validation failed after ${retries} attempts: The AI response did not match the expected schema structure. This may be due to schema complexity or content length. ${lastError.message}`);
  } else if (lastError?.message?.includes('No object generated')) {
    throw new Error(`No object generated after ${retries} attempts: AI response did not match schema. Try simplifying the analysis requirements.`);
  }

  // Re-throw with more detailed error message
  throw new Error(`Failed to generate AI response after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
}

const generateAiResponseMarkdown = async ({ system, content }) => {
  try {
    if (!system || !content) {
      throw new Error('Missing required parameters: system or content');
    }

    // Ensure content is properly formatted as an array of message objects
    const messages = Array.isArray(content)
      ? content
      : [{ role: "user", content: content }];

    const completion = await generateText({
      model: azure("gpt-4o-mini"),
      system,
      messages,
      maxOutputTokens: 1500, // Use correct parameter name
      temperature: 0.7
    });

    if (!completion) {
      throw new Error('Failed to generate AI response markdown');
    }

    return {
      text: completion.text,
      // Add any additional processing or metadata here if needed
    };
  } catch (error) {
    console.error('AI Response Generation Error:', error);
    throw new Error(`Failed to generate AI response: ${error.message}`);
  }
}

export { generateAiResponseObject, generateAiResponseMarkdown }

