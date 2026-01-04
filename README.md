# Calendar Scheduler App

A 1-day calendar app powered by GitHub Gist as its database.

## Setup

This app uses GitHub Gist as its database. You'll need a GitHub Personal Access Token with `gist` scope.

### Option 1: Enter Token in App (Recommended)
1. Start the app with `npm start`
2. When prompted, enter your GitHub Personal Access Token
3. The token will be stored in your browser's localStorage

### Option 2: Environment Variable
Create a `.env` file in the root directory:
```
REACT_APP_GITHUB_TOKEN=your_token_here
```

### Creating a GitHub Token
1. Go to [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens/new)
2. Generate a new token with the `gist` scope
3. Copy the token and use it in the app

## Database

The app stores calendar data in a GitHub Gist:
- Gist ID: `62b41253c63e6f0d722c33c4f29bc0e9`
- File: `schedules.json`

The data structure:
```json
{
  "calendars": [
    {
      "id": "string",
      "name": "string"
    }
  ]
}
```

## Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
