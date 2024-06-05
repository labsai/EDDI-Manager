import * as React from 'react';
import PackageInfo from '../PackageDetailView/PackageInfo';
import Parser from '../utils/Parser';
import { useLocation, useParams } from 'react-router';

function getVersion(search: string) {
  const queryStrings = Parser.getQueryStrings(search);
  return queryStrings.version;
}

const PackageViewPage = () => {
  const { id } = useParams();
  const { search } = useLocation();
  return (
    <div>
      <PackageInfo packageId={id} version={getVersion(search)} />
    </div>
  );
};

export default PackageViewPage;
