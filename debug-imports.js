
try {
    console.log('Test 1: Importing express');
    const express = (await import('express')).default;
    console.log('Express imported');

    console.log('Test 2: Importing local provider');
    const provider = await import('./providers/vertexProvider.js');
    console.log('Provider imported');

    console.log('Test 3: Importing google-genai');
    const genai = await import('@google/genai');
    console.log('GenAI imported');

} catch (err) {
    console.error('Import failed:', err);
}
