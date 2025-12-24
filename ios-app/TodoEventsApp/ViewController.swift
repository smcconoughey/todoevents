import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate {
    private let webView = WKWebView()
    private let spinner = UIActivityIndicatorView(style: .large)
    private let refreshControl = UIRefreshControl()
    private let webAppURL = URL(string: "https://todo-events.com")!

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .unspecified
        view.backgroundColor = .systemBackground
        webView.backgroundColor = .systemBackground
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.scrollView.refreshControl = refreshControl
        refreshControl.tintColor = .secondaryLabel
        refreshControl.addTarget(self, action: #selector(refresh), for: .valueChanged)

        view.addSubview(webView)
        view.addSubview(spinner)

        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.color = .label

        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])

        spinner.startAnimating()
        webView.load(URLRequest(url: webAppURL))
    }

    @objc private func refresh() {
        webView.reload()
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        spinner.startAnimating()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        spinner.stopAnimating()
        refreshControl.endRefreshing()
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, url.path.contains("/subscribe") {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }
}
