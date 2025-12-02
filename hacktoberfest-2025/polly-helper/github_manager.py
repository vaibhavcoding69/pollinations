"""GitHub integration for creating and tracking issues."""

import json
from datetime import datetime
from pathlib import Path
from github import Github, GithubException
from config import GITHUB_TOKEN, GITHUB_REPO


class GitHubManager:
    """Manages GitHub issue creation and tracking."""

    def __init__(self):
        self.github = Github(GITHUB_TOKEN) if GITHUB_TOKEN else None
        self.repo = None
        if self.github and GITHUB_REPO:
            try:
                self.repo = self.github.get_repo(GITHUB_REPO)
            except GithubException as e:
                print(f"Failed to connect to GitHub repo: {e}")
        
        # Track issue -> user mapping
        self.tracking_file = Path(__file__).parent / "issue_tracking.json"
        self.tracked_issues = self._load_tracking()

    def _load_tracking(self) -> dict:
        """Load issue tracking data from file."""
        if self.tracking_file.exists():
            try:
                with open(self.tracking_file, "r") as f:
                    return json.load(f)
            except:
                pass
        return {}

    def _save_tracking(self):
        """Save issue tracking data to file."""
        with open(self.tracking_file, "w") as f:
            json.dump(self.tracked_issues, f, indent=2)

    async def create_issue(self, user_id: int, username: str, issue_description: str, 
                           original_message: str) -> dict:
        """
        Create a GitHub issue for a server-side problem.
        
        Args:
            user_id: Discord user ID
            username: Discord username
            issue_description: AI-generated description of the issue
            original_message: Original user message
            
        Returns:
            Dict with issue info or error
        """
        if not self.repo:
            return {"success": False, "error": "GitHub not configured"}

        # Create concise title from issue description (first line or first 60 chars)
        first_line = issue_description.split('\n')[0].strip()[:60]
        title = f"[Discord Bot] {first_line}"
        
        body = f"""**Issue:** {issue_description}

**User message:** {original_message[:200]}

---
_Discord user: {username} | {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC_
"""

        try:
            issue = self.repo.create_issue(
                title=title,
                body=body,
                labels=["bot-report", "needs-triage"]
            )
            
            # Track the issue
            self.tracked_issues[str(issue.number)] = {
                "user_id": user_id,
                "username": username,
                "created_at": datetime.utcnow().isoformat(),
                "status": "open"
            }
            self._save_tracking()

            return {
                "success": True,
                "issue_number": issue.number,
                "issue_url": issue.html_url
            }
            
        except GithubException as e:
            return {"success": False, "error": str(e)}

    async def check_closed_issues(self) -> list:
        """
        Check for issues that have been closed since last check.
        
        Returns:
            List of closed issue info with user IDs to notify
        """
        if not self.repo:
            return []

        closed_issues = []
        
        for issue_number, tracking_info in list(self.tracked_issues.items()):
            if tracking_info.get("status") == "closed":
                continue
                
            try:
                issue = self.repo.get_issue(int(issue_number))
                
                if issue.state == "closed":
                    # Issue was closed!
                    closed_issues.append({
                        "issue_number": int(issue_number),
                        "issue_url": issue.html_url,
                        "user_id": tracking_info["user_id"],
                        "username": tracking_info["username"],
                        "closed_at": issue.closed_at.isoformat() if issue.closed_at else None,
                        "resolution": self._get_resolution_comment(issue)
                    })
                    
                    # Update tracking
                    self.tracked_issues[issue_number]["status"] = "closed"
                    self._save_tracking()
                    
            except GithubException:
                continue

        return closed_issues

    def _get_resolution_comment(self, issue) -> str:
        """Get the last comment from the issue as resolution info."""
        try:
            comments = list(issue.get_comments())
            if comments:
                return comments[-1].body[:500]
        except:
            pass
        return "The issue has been resolved."


# Singleton instance
github_manager = GitHubManager()