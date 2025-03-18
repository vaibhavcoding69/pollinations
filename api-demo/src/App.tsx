import React from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import ApiConfigurator from './components/ApiConfigurator';

// Create a theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ApiConfigurator />
    </ThemeProvider>
  );
}

export default App;
