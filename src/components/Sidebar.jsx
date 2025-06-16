import React from 'react';
import './Sidebar.css';

function Sidebar() {
  const [activeLink, setActiveLink] = React.useState('Base de Données');
  const navItems = [
    { name: 'Base de Données', icon: '🗃️' },
    { name: 'Ma Collection', icon: '📚' },
    { name: 'Constructeur de Deck', icon: '🛠️' },
    { name: 'Listes de Bannissement', icon: '🚫' },
    { name: 'Extensions', icon: '📦' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>Mo-Mo-Oh!</h3>
      </div>
      <nav className="sidebar-nav">
        <ul>
          {navItems.map(item => (
            <li key={item.name} className={activeLink === item.name ? 'active' : ''}>
              <a href="#" onClick={(e) => { e.preventDefault(); setActiveLink(item.name); /* Gérer la navigation ici */ }}>
                <span className="nav-icon">{item.icon}</span>
                {item.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
export default Sidebar;