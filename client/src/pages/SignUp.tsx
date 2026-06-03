import { Navigate } from 'react-router-dom';

// Self-registration is disabled. Accounts are created by system administrators only.
const SignUp = () => <Navigate to="/login" replace />;

export default SignUp;
