import { useNavigate } from 'react-router-dom';

const useNav = () => {
  const navigate = useNavigate();
  
  return (path: string) => {
    navigate(path);
  };
};

export default useNav; 