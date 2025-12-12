
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Lock } from "lucide-react";

interface LoginFormProps {
  onLogin: (role: 'admin' | 'scouter', username: string) => void;
}

const LoginForm = ({ onLogin }: LoginFormProps) => {
  const { toast } = useToast();
  const [loginType, setLoginType] = useState<'admin' | 'scouter'>('scouter');
  const [username, setUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  // Admin password (in real app, this would be stored securely)
  const ADMIN_PASSWORD = 'admin123';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({
        title: "Username Required",
        description: "Please enter a username.",
        variant: "destructive"
      });
      return;
    }

    // If scouter, require Firstname and Last initial (e.g. "Alex D." or "Alex D")
    if (loginType === 'scouter') {
      const trimmed = username.trim();
      const scouterRegex = /^[A-Za-z]+\s+[A-Za-z]\.?$/;
      if (!scouterRegex.test(trimmed)) {
        toast({
          title: "Invalid Scouter Name",
          description: "Please enter your first name and last initial (e.g. 'Alex D.' ).",
          variant: "destructive"
        });
        return;
      }
    }

    if (loginType === 'admin') {
      if (adminPassword !== ADMIN_PASSWORD) {
        toast({
          title: "Invalid Admin Password",
          description: "The admin password is incorrect.",
          variant: "destructive"
        });
        return;
      }
    }

    toast({
      title: "Login Successful",
      description: `Welcome ${username}! Logged in as ${loginType}.`,
    });

    onLogin(loginType, username);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Lock className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-foreground">FRC Strategy Hub</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Login to access the scouting platform
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Login</CardTitle>
              <CardDescription>
                Select your role and enter your credentials
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Role</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={loginType === 'scouter' ? 'default' : 'outline'}
                      onClick={() => setLoginType('scouter')}
                      className="flex items-center space-x-2"
                    >
                      <Users className="h-4 w-4" />
                      <span>Scouter</span>
                    </Button>
                    <Button
                      type="button"
                      variant={loginType === 'admin' ? 'default' : 'outline'}
                      onClick={() => setLoginType('admin')}
                      className="flex items-center space-x-2"
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>

                {loginType === 'admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">Admin Password</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      placeholder="Enter admin password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                )}

                <Button type="submit" className="w-full">
                  Login as {loginType === 'admin' ? 'Admin' : 'Scouter'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
