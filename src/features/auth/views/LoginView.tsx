import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { TextField, Button, Box, Typography, Link, Alert } from '@mui/material';
import { useAuth } from '../../shared/hooks/useAuth';

const LoginView = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate('/'); // Redirect to dashboard on successful login
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
      }}
    >
      <Box
        component="form"
        onSubmit={handleLogin}
        sx={{
          p: 4,
          backgroundColor: 'white',
          borderRadius: 2,
          boxShadow: 3,
          width: '100%',
          maxWidth: 400,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom textAlign="center">
          ProcureFlow
        </Typography>
        <Typography variant="body2" textAlign="center" mb={3}>
          Enhanced Purchasing System
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Email Address"
          variant="outlined"
          fullWidth
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          variant="outlined"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ mt: 2, mb: 2 }}
          disabled={isLoading}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </Button>

        <Typography variant="body2" textAlign="center">
          <Link component={RouterLink} to="/forgot-password">
            Forgot Password?
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginView;
