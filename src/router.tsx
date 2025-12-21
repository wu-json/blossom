import { Switch, Route, Redirect } from "wouter";
import { ChatRoute } from "./features/chat/chat-route";
import { MeadowRoute } from "./features/meadow/meadow-route";
import { TeacherPage } from "./features/teacher";
import { SettingsPage } from "./features/settings";
import { YouTubeViewer } from "./features/youtube/youtube-viewer";

export function AppRouter() {
  return (
    <Switch>
      <Route path="/chat/:id" component={ChatRoute} />
      <Route path="/chat" component={ChatRoute} />
      <Route path="/meadow/:word" component={MeadowRoute} />
      <Route path="/meadow" component={MeadowRoute} />
      <Route path="/youtube" component={YouTubeViewer} />
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
