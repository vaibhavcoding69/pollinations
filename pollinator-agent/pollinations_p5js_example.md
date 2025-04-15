# Pollinations.AI Integration for p5.js-example Repository

This document contains the files and instructions for adding a Pollinations.AI integration example to the p5.js-example repository.

## Files to Create

### 1. code.js

Create this file at: `/examples/03_Imported_Media/08_Pollinations_AI_Image_Generation/code.js`

```javascript
/*
 * Pollinations.AI Image Generation
 * 
 * This example demonstrates how to use Pollinations.AI's free image generation API
 * with p5.js to create and display AI-generated images based on text prompts.
 * 
 * Pollinations.AI provides free, no-signup APIs for text, image, and audio generation
 * with no API keys required.
 * 
 * The example shows how to:
 * 1. Generate an image from a text prompt using Pollinations.AI
 * 2. Display the generated image in a p5.js sketch
 * 3. Allow users to enter their own prompts to generate new images
 * 
 * Learn more about Pollinations.AI: https://pollinations.ai
 * API Documentation: https://github.com/pollinations/pollinations/blob/master/APIDOCS.md
 */

let generatedImg; // Variable to store the generated image
let promptInput; // Input field for the text prompt
let generateButton; // Button to generate a new image
let loadingMessage = ""; // Message to display while loading

function setup() {
  // Create canvas
  createCanvas(600, 600);
  
  // Create input field for text prompt
  promptInput = createInput('colorful abstract landscape');
  promptInput.position(20, height + 20);
  promptInput.size(400);
  
  // Create button to generate image
  generateButton = createButton('Generate Image');
  generateButton.position(430, height + 20);
  generateButton.mousePressed(generateImage);
  
  // Generate initial image
  generateImage();
  
  // Add accessible description
  describe('An AI-generated image created with Pollinations.AI based on a user-provided text prompt. Below the image is a text input field and a generate button to create new images.');
}

function draw() {
  background(240);
  
  // Display loading message if no image is loaded yet
  if (!generatedImg) {
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(18);
    text(loadingMessage, width/2, height/2);
    return;
  }
  
  // Display the generated image
  imageMode(CENTER);
  let imgRatio = generatedImg.width / generatedImg.height;
  let displayWidth, displayHeight;
  
  if (imgRatio > 1) {
    // Landscape orientation
    displayWidth = min(width - 40, generatedImg.width);
    displayHeight = displayWidth / imgRatio;
  } else {
    // Portrait or square orientation
    displayHeight = min(height - 40, generatedImg.height);
    displayWidth = displayHeight * imgRatio;
  }
  
  image(generatedImg, width/2, height/2, displayWidth, displayHeight);
  
  // Display prompt text
  fill(0);
  textAlign(CENTER);
  textSize(14);
  text('Prompt: "' + promptInput.value() + '"', width/2, height - 20);
  
  // Update accessible description with current prompt
  describeElement('generatedImage', 'AI-generated image based on the prompt: ' + promptInput.value());
}

function generateImage() {
  // Show loading message
  loadingMessage = "Generating image...";
  generatedImg = null;
  
  // Get the prompt from the input field
  let prompt = encodeURIComponent(promptInput.value());
  
  // Create the Pollinations.AI image URL
  let imageUrl = `https://image.pollinations.ai/prompt/${prompt}`;
  
  // Load the image
  loadImage(
    imageUrl,
    // Success callback
    img => {
      generatedImg = img;
      loadingMessage = "";
    },
    // Error callback
    () => {
      loadingMessage = "Error loading image. Please try again.";
    }
  );
}

// Handle window resize
function windowResized() {
  // Update input and button positions
  promptInput.position(20, height + 20);
  generateButton.position(430, height + 20);
}
```

### 2. index.html

Create this file at: `/examples/03_Imported_Media/08_Pollinations_AI_Image_Generation/index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pollinations.AI Image Generation - p5.js Example</title>
  <style>
    body {
      padding: 0;
      margin: 0;
      font-family: sans-serif;
    }
    main {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
    .description {
      max-width: 600px;
      margin-bottom: 20px;
      line-height: 1.5;
    }
    canvas {
      display: block;
      margin-bottom: 30px;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
  <script src="code.js"></script>
</head>
<body>
  <main>
    <div class="description">
      <h1>Pollinations.AI Image Generation</h1>
      <p>
        This example demonstrates how to use <a href="https://pollinations.ai" target="_blank">Pollinations.AI</a>'s 
        free image generation API with p5.js to create and display AI-generated images based on text prompts.
      </p>
      <p>
        Pollinations.AI provides free, no-signup APIs for text, image, and audio generation with no API keys required.
        Enter a text prompt in the input field below the canvas and click "Generate Image" to create a new AI-generated image.
      </p>
      <p>
        <a href="https://github.com/pollinations/pollinations/blob/master/APIDOCS.md" target="_blank">API Documentation</a>
      </p>
    </div>
  </main>
</body>
</html>
```

### 3. thumbnail.png

Generate a thumbnail image for the example. This should be a 200x200 pixel image that represents the example. You can generate this using Pollinations.AI itself with a prompt like "colorful abstract landscape, p5.js visualization, small square thumbnail".

## Instructions for Adding to Repository

1. Create the directory structure:
   ```bash
   mkdir -p examples/03_Imported_Media/08_Pollinations_AI_Image_Generation
   ```

2. Create the files:
   - Copy the `code.js` content to `examples/03_Imported_Media/08_Pollinations_AI_Image_Generation/code.js`
   - Copy the `index.html` content to `examples/03_Imported_Media/08_Pollinations_AI_Image_Generation/index.html`
   - Add a thumbnail image as `examples/03_Imported_Media/08_Pollinations_AI_Image_Generation/thumbnail.png`

3. Update the README.md to include the new example in the "Imported Media" section:
   ```markdown
   [Pollinations.AI Image Generation](https://github.com/processing/p5.js-example/blob/main/examples%5C03_Imported_Media%5C08_Pollinations_AI_Image_Generation%5Ccode.js)
   ```

4. Commit the changes:
   ```bash
   git add examples/03_Imported_Media/08_Pollinations_AI_Image_Generation
   git commit -m "Add Pollinations.AI Image Generation example"
   git push origin add-pollinations-ai
   ```

5. Create a pull request from the `add-pollinations-ai` branch to the main repository.

## Pull Request Description

When creating the pull request, use the following description:

```
# Add Pollinations.AI Image Generation Example

This PR adds a new example demonstrating how to use Pollinations.AI's free image generation API with p5.js.

## Features
- Generates images from text prompts using Pollinations.AI
- Displays the generated image in a p5.js sketch
- Allows users to enter their own prompts to generate new images
- Includes accessibility features (describe() and describeElement())

## Why Pollinations.AI?
Pollinations.AI provides free, no-signup APIs for text, image, and audio generation with no API keys required, making it perfect for educational purposes and creative coding projects.

## Resources
- [Pollinations.AI Website](https://pollinations.ai)
- [API Documentation](https://github.com/pollinations/pollinations/blob/master/APIDOCS.md)
```
