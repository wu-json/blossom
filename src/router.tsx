import { Switch, Route, Redirect } from "wouter";
import { ChatRoute } from "./features/chat/chat-route";
import { GardenRoute } from "./features/garden/garden-route";
import { TeacherPage } from "./features/teacher";
import { SettingsPage } from "./features/settings";

export function AppRouter() {
  return (
    <Switch>
      <Route path="/chat/:id" component={ChatRoute} />
      <Route path="/chat" component={ChatRoute} />
      <Route path="/garden/:word" component={GardenRoute} />
      <Route path="/garden" component={GardenRoute} />
      <Route path="/teacher" component={TeacherPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/">
        <Redirect to="/chat" />
      </Route>
      <Route>
        <Redirect to="/chat" />
      </Route>
    </Switch>
  );
}
